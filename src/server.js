import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import fsp from "node:fs/promises";
import { paths, limits } from "./config.js";
import { ensureDir } from "./lib/fs-utils.js";
import { JsonStore } from "./lib/store.js";
import { executeImport, stageBatchFromUploads } from "./lib/importer.js";
import { normalizePage, normalizePageSize } from "./lib/paginate.js";
import { hydrateAssets, queryAssets, timelineByDay } from "./lib/library.js";
import {
  addAssetsToAlbum,
  createAlbum,
  deleteAlbum,
  getAlbum,
  listAlbums,
  removeAssetFromAlbum,
  updateAlbum,
} from "./lib/albums.js";
import { bulkDeleteAssets, deleteAsset } from "./lib/assets.js";
import { latestReadyShareDerivative } from "./lib/derivatives.js";
import { createMemoryRateLimiter } from "./lib/rate-limit.js";
import { listDerivativeJobs, processDerivativeJobs } from "./lib/derivative-jobs.js";
import {
  createAlbumShare,
  getShareByToken,
  listShareAssets,
  listShares,
  revokeShare,
  validateShareAccess,
} from "./lib/shares.js";

const app = express();
const port = Number(process.env.PORT || 8787);
const scrypt = promisify(scryptCb);

const store = new JsonStore(paths.dbPath);
const shareRateLimiter = createMemoryRateLimiter({ windowMs: 60_000, max: 1200 });

const jobWorkerEnabled = asBoolean(process.env.ALPHA_JOB_WORKER_ENABLED, true);
const jobWorkerIntervalMs = Math.max(5_000, Number(process.env.ALPHA_JOB_WORKER_INTERVAL_MS || 30_000));
let jobWorkerTimer = null;
let jobWorkerRunning = false;
let jobWorkerLastRunAt = null;
let jobWorkerLastResult = null;

function clientKey(req) {
  return req.ip || req.headers["x-forwarded-for"] || "unknown";
}

function sharePassword(req) {
  return req.query.password ?? req.headers["x-share-password"] ?? null;
}

function ext(name = "") {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function sourceMime(name = "") {
  const e = ext(name);
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  if (e === ".gif") return "image/gif";
  if (e === ".mp4") return "video/mp4";
  if (e === ".mts") return "video/mp2t";
  if (e === ".arw") return "image/x-sony-arw";
  return "application/octet-stream";
}

function pickOwnerPreviewSource(sourceFiles = []) {
  const jpeg = sourceFiles.find((sf) => [".jpg", ".jpeg"].includes(ext(sf.originalName)));
  if (jpeg) return jpeg;

  const png = sourceFiles.find((sf) => ext(sf.originalName) === ".png");
  if (png) return png;

  const webp = sourceFiles.find((sf) => ext(sf.originalName) === ".webp");
  if (webp) return webp;

  const gif = sourceFiles.find((sf) => ext(sf.originalName) === ".gif");
  if (gif) return gif;

  const mp4 = sourceFiles.find((sf) => ext(sf.originalName) === ".mp4");
  if (mp4) return mp4;

  return null;
}

async function ensureThumbForAsset(asset, db) {
  const thumbsDir = path.join(paths.derivativesRoot, "thumbs");
  await ensureDir(thumbsDir);
  const thumbPath = path.join(thumbsDir, `${asset.id}-thumb.jpg`);
  if (fs.existsSync(thumbPath)) return thumbPath;

  const source = pickOwnerPreviewSource(asset.sourceFiles);
  if (!source?.storagePath) return null;

  if (asset.type === "video") return source.storagePath;

  try {
    const mod = await import("sharp");
    const sharp = mod.default || mod;
    await sharp(source.storagePath).rotate().resize(512, 512, { fit: "cover" }).jpeg({ quality: 72 }).toFile(thumbPath);
    return thumbPath;
  } catch {
    // fallback: no sharp installed or unsupported file
    return source.storagePath;
  }
}

function withShareRateLimit(req, res, next) {
  const bucket = shareRateLimiter.check(clientKey(req));
  if (!bucket.allowed) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({ error: "Too many share requests. Slow down." });
  }
  return next();
}

function scrubAsset(asset) {
  return {
    ...asset,
    sourceFiles: (asset.sourceFiles ?? []).map((sf) => ({
      id: sf.id,
      originalName: sf.originalName,
      ext: sf.ext,
      kind: sf.kind,
      raw: sf.raw,
      jpeg: sf.jpeg,
      checksum: sf.checksum,
      size: sf.size,
      mimeType: sf.mimeType,
      takenAt: sf.takenAt,
      importedAt: sf.importedAt,
      metadataSource: sf.metadataSource,
      downloadUrl: `/api/owner/source-files/${sf.id}/download`,
    })),
  };
}

function sendFileSafe(res, filePath, { notFoundMessage = "File not found" } = {}) {
  const normalizedPath = path.resolve(filePath);

  fs.access(normalizedPath, fs.constants.R_OK, (accessError) => {
    if (accessError) {
      if (!res.headersSent) res.status(404).json({ error: notFoundMessage });
      return;
    }

    const stream = fs.createReadStream(normalizedPath);
    stream.on("error", () => {
      if (!res.headersSent) res.status(500).json({ error: "Failed to read file" });
    });
    stream.pipe(res);
  });
}

function asBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return raw.split(";").reduce((acc, part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return acc;
    acc[k] = decodeURIComponent(rest.join("=") || "");
    return acc;
  }, {});
}

function cookieOptions(req) {
  const forwarded = req.headers["x-forwarded-proto"];
  const secure = process.env.NODE_ENV === "production" || forwarded === "https";
  return `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

async function hashPassword(password) {
  const salt = randomUUID().replaceAll("-", "");
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${Buffer.from(derived).toString("hex")}`;
}

async function verifyPassword(password, stored) {
  if (!stored?.startsWith("scrypt:")) return false;
  const [, salt, hashHex] = stored.split(":");
  const derived = await scrypt(password, salt, 64);
  const a = Buffer.from(hashHex, "hex");
  const b = Buffer.from(derived);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sessionFromReq(req, db) {
  const sid = parseCookies(req).alpha_session;
  if (!sid) return null;
  const session = db.sessions.find((s) => s.id === sid && !s.revokedAt && (!s.expiresAt || new Date(s.expiresAt) > new Date()));
  if (!session) return null;
  const user = db.users.find((u) => u.id === session.userId && !u.disabledAt);
  if (!user) return null;
  return { session, user };
}

async function requireAuth(req, res, next) {
  const db = await store.read();
  const current = sessionFromReq(req, db);
  if (!current) return res.status(401).json({ error: "Authentication required" });
  req.auth = current;
  return next();
}

function requireAdmin(req, res, next) {
  if (req.auth?.user?.role !== "admin") return res.status(403).json({ error: "Admin required" });
  return next();
}

async function runDerivativeWorkerTick() {
  if (jobWorkerRunning) {
    return { skipped: true, reason: "worker_already_running" };
  }

  jobWorkerRunning = true;
  jobWorkerLastRunAt = new Date().toISOString();
  try {
    const result = await store.update((db) =>
      processDerivativeJobs({
        db,
        paths,
        limit: 20,
        force: false,
      }),
    );
    jobWorkerLastResult = result;
    return result;
  } finally {
    jobWorkerRunning = false;
  }
}

function startDerivativeWorker() {
  if (!jobWorkerEnabled || jobWorkerTimer) return;

  jobWorkerTimer = setInterval(() => {
    runDerivativeWorkerTick().catch(() => {
      // no-op: state is surfaced via worker status endpoint
    });
  }, jobWorkerIntervalMs);
}

async function bootstrap() {
  await ensureDir(paths.storageRoot);
  await ensureDir(paths.tempUploads);
  await ensureDir(paths.stagingRoot);
  await ensureDir(paths.originalsRoot);
  await ensureDir(paths.derivativesRoot);
  await store.init();
}

const upload = multer({ dest: paths.tempUploads });

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/docs", express.static(path.join(paths.root, "docs")));

app.get("/", (_req, res) => res.redirect("/app"));

   app.get("/app/login", (_req, res) => {
   res.setHeader("Cache-Control", "no-store");
   return res.sendFile("login.html", { root: path.join(paths.root, "app") });
   });

   app.get("/app/share.html", (_req, res) => {
   res.setHeader("Cache-Control", "no-store");
   return res.sendFile("share.html", { root: path.join(paths.root, "app") });
   });

async function serveOwnerApp(req, res) {
  const db = await store.read();
  if (!sessionFromReq(req, db)) return res.redirect("/app/login");
  res.setHeader("Cache-Control", "no-store");
  return res.sendFile("index.html", { root: path.join(paths.root, "app") });
}

app.get("/app", serveOwnerApp);
app.get("/app/index.html", serveOwnerApp);
app.get("/uat", serveOwnerApp);

app.get("/api/health", async (_req, res) => {
  const db = await store.read();
  res.json({
    ok: true,
    service: "alpha-ingest",
    stats: {
      batches: db.batches.length,
      imports: db.imports.length,
      assets: db.assets.length,
      albums: db.albums.length,
      derivatives: db.derivatives.length,
      derivativeJobs: db.derivativeJobs.length,
      shares: db.shares.length,
      users: db.users.length,
    },
  });
});

app.get("/api/auth/bootstrap-status", async (_req, res) => {
  const db = await store.read();
  return res.json({ needsSetup: db.users.length === 0 });
});

app.post("/api/auth/setup", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!username || password.length < 8) return res.status(400).json({ error: "username and password(>=8) required" });

  try {
    const result = await store.update(async (db) => {
      if (db.users.length > 0) throw new Error("Setup already completed");
      const user = {
        id: randomUUID(),
        username,
        role: "admin",
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
        disabledAt: null,
      };
      db.users.push(user);
      const session = {
        id: randomUUID(),
        userId: user.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        revokedAt: null,
      };
      db.sessions.push(session);
      return { user, sessionId: session.id };
    });
    res.setHeader("Set-Cookie", `alpha_session=${encodeURIComponent(result.sessionId)}; ${cookieOptions(req)}`);
    return res.status(201).json({ ok: true, user: { id: result.user.id, username: result.user.username, role: result.user.role } });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const db = await store.read();
  const user = db.users.find((u) => u.username === username && !u.disabledAt);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  if (!(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ error: "Invalid credentials" });

  const session = await store.update((wdb) => {
    const s = {
      id: randomUUID(),
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      revokedAt: null,
    };
    wdb.sessions.push(s);
    return s;
  });

  res.setHeader("Set-Cookie", `alpha_session=${encodeURIComponent(session.id)}; ${cookieOptions(req)}`);
  return res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role } });
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  const sid = req.auth.session.id;
  await store.update((db) => {
    const s = db.sessions.find((x) => x.id === sid);
    if (s) s.revokedAt = new Date().toISOString();
    return null;
  });
  res.setHeader("Set-Cookie", `alpha_session=; ${cookieOptions(req)}; Max-Age=0`);
  return res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  return res.json({ user: { id: req.auth.user.id, username: req.auth.user.username, role: req.auth.user.role } });
});

app.get("/api/admin/users", requireAuth, requireAdmin, async (_req, res) => {
  const db = await store.read();
  return res.json({
    items: db.users.map((u) => ({ id: u.id, username: u.username, role: u.role, disabledAt: u.disabledAt, createdAt: u.createdAt })),
  });
});

app.post("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const role = req.body?.role === "admin" ? "admin" : "user";
  if (!username || password.length < 8) return res.status(400).json({ error: "username and password(>=8) required" });

  try {
    const created = await store.update(async (db) => {
      if (db.users.some((u) => u.username === username)) throw new Error("Username already exists");
      const user = {
        id: randomUUID(),
        username,
        role,
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
        disabledAt: null,
      };
      db.users.push(user);
      return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt, disabledAt: null };
    });
    return res.status(201).json(created);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.patch("/api/admin/users/:userId/password", requireAuth, requireAdmin, async (req, res) => {
  const password = String(req.body?.password || "");
  if (password.length < 8) return res.status(400).json({ error: "password must be >= 8 chars" });
  try {
    await store.update(async (db) => {
      const user = db.users.find((u) => u.id === req.params.userId);
      if (!user) throw new Error("User not found");
      user.passwordHash = await hashPassword(password);
      return null;
    });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.patch("/api/admin/users/:userId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const updated = await store.update((db) => {
      const user = db.users.find((u) => u.id === req.params.userId);
      if (!user) throw new Error("User not found");
      if (req.body?.role) user.role = req.body.role === "admin" ? "admin" : "user";
      if (req.body?.disabled !== undefined) user.disabledAt = req.body.disabled ? new Date().toISOString() : null;
      return { id: user.id, username: user.username, role: user.role, disabledAt: user.disabledAt };
    });
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.use("/api", (req, res, next) => {
  const open = ["/health", "/auth/bootstrap-status", "/auth/setup", "/auth/login", "/shares"];
  if (open.some((p) => req.path === p || req.path.startsWith(`${p}/`))) return next();
  return requireAuth(req, res, next);
});

app.get("/api/owner/settings", async (_req, res) => {
  const db = await store.read();
  return res.json(db.settings);
});

app.patch("/api/owner/settings", async (req, res) => {
  try {
    const settings = await store.update((db) => {
      db.settings = { ...db.settings, ...(req.body ?? {}) };
      return db.settings;
    });
    return res.json(settings);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/api/staging/upload", (req, res) => {
  upload.array("files", limits.maxFilesPerBatch)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      const batchId = randomUUID();
      const batch = await stageBatchFromUploads({
        multerFiles: req.files,
        batchId,
        paths,
        store,
      });

      return res.status(201).json({
        batchId: batch.id,
        status: batch.status,
        summary: batch.summary,
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });
});

app.get("/api/staging/:batchId", async (req, res) => {
  const db = await store.read();
  const batch = db.batches.find((b) => b.id === req.params.batchId);
  if (!batch) return res.status(404).json({ error: "Batch not found" });

  return res.json({
    id: batch.id,
    status: batch.status,
    createdAt: batch.createdAt,
    completedAt: batch.completedAt,
    summary: batch.summary,
  });
});

app.post("/api/imports/:batchId/execute", async (req, res) => {
  const createAlbums = req.body?.createAlbums !== false;
  const rule = req.body?.rule ?? "day_imported";
  const albumName = req.body?.albumName ?? null;

  if (!["day_taken", "day_imported", "new_name"].includes(rule)) {
    return res.status(400).json({ error: "Invalid rule" });
  }

  if (createAlbums && rule === "new_name" && !albumName?.trim()) {
    return res.status(400).json({ error: "albumName is required when rule = new_name" });
  }

  try {
    const importLog = await executeImport({
      batchId: req.params.batchId,
      createAlbums,
      rule,
      albumName,
      paths,
      store,
    });

    return res.status(201).json(importLog);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get("/api/imports/:importId/log", async (req, res) => {
  const db = await store.read();
  const importLog = db.imports.find((entry) => entry.id === req.params.importId);
  if (!importLog) return res.status(404).json({ error: "Import log not found" });

  return res.json(importLog);
});

app.get("/api/imports/recent", async (req, res) => {
  const db = await store.read();
  const limit = normalizePageSize(req.query.limit, 5, 20);
  const items = [...db.imports]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
    .map((entry) => ({
      id: entry.id,
      batchId: entry.batchId,
      createdAt: entry.createdAt,
      counts: entry.counts,
      createdAlbumIds: entry.createdAlbumIds,
      notes: entry.notes,
    }));

  return res.json({ items });
});

app.get("/api/library/summary", async (_req, res) => {
  const db = await store.read();

  return res.json({
    assets: db.assets.length,
    sourceFiles: db.sourceFiles.length,
    derivatives: db.derivatives.length,
    derivativeJobs: db.derivativeJobs.length,
    albums: db.albums.length,
    shares: db.shares.length,
    imports: db.imports.length,
    stagedBatches: db.batches.filter((b) => b.status === "staged").length,
  });
});

app.get("/api/library/assets", async (req, res) => {
  const db = await store.read();

  const result = queryAssets(db, {
    type: req.query.type,
    search: req.query.search,
    rawOnly: asBoolean(req.query.rawOnly),
    jpegOnly: asBoolean(req.query.jpegOnly),
    cameraModel: req.query.cameraModel,
    page: normalizePage(req.query.page, 1),
    pageSize: normalizePageSize(req.query.pageSize, 50, 200),
  });

  return res.json({
    ...result,
    items: result.items.map((asset) => ({
      ...scrubAsset(asset),
      previewUrl: `/api/owner/assets/${asset.id}/preview`,
    })),
  });
});

app.get("/api/library/assets/:assetId", async (req, res) => {
  const db = await store.read();
  const asset = hydrateAssets(db).find((a) => a.id === req.params.assetId);
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  return res.json({
    ...scrubAsset(asset),
    previewUrl: `/api/owner/assets/${asset.id}/preview`,
  });
});

app.delete("/api/library/assets/:assetId", async (req, res) => {
  try {
    const result = await store.update((db) => deleteAsset(db, req.params.assetId));
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/api/library/bulk-delete", async (req, res) => {
  try {
    const assetIds = Array.isArray(req.body?.assetIds) ? req.body.assetIds : [];
    if (!assetIds.length) {
      return res.status(400).json({ error: "No assetIds provided" });
    }
    const results = await store.update((db) => bulkDeleteAssets(db, assetIds));
    return res.json({ results });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/api/library/assets/bulk-delete", async (req, res) => {
  const assetIds = Array.isArray(req.body?.assetIds) ? req.body.assetIds.filter(Boolean) : [];
  if (!assetIds.length) {
    return res.status(400).json({ error: "assetIds[] is required" });
  }

  const deleted = [];
  const failed = [];

  for (const assetId of assetIds) {
    try {
      const result = await store.update((db) => deleteAsset(db, assetId));
      deleted.push({ assetId, ...result });
    } catch (error) {
      failed.push({ assetId, error: error.message });
    }
  }

  return res.json({
    requested: assetIds.length,
    deletedCount: deleted.length,
    failedCount: failed.length,
    deleted,
    failed,
  });
});

app.get("/api/owner/assets/:assetId/thumb", async (req, res) => {
  const db = await store.read();
  const asset = hydrateAssets(db).find((a) => a.id === req.params.assetId);
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  const thumbPath = await ensureThumbForAsset(asset, db);
  if (!thumbPath) return res.status(415).json({ error: "Thumbnail not available" });

  const isJpeg = thumbPath.endsWith("-thumb.jpg");
  res.setHeader("Content-Type", isJpeg ? "image/jpeg" : sourceMime(thumbPath));
  res.setHeader("Cache-Control", "private, max-age=600");
  return sendFileSafe(res, thumbPath, { notFoundMessage: "Thumb file missing" });
});

app.get("/api/owner/assets/:assetId/preview", async (req, res) => {
  const db = await store.read();
  const asset = hydrateAssets(db).find((a) => a.id === req.params.assetId);
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  const derivative = latestReadyShareDerivative(db, asset.id);
  if (derivative?.storagePath) {
    res.setHeader("Content-Type", derivative.mimeType || "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=120");
    return sendFileSafe(res, derivative.storagePath, { notFoundMessage: "Preview file missing" });
  }

  const fallback = pickOwnerPreviewSource(asset.sourceFiles);
  if (!fallback?.storagePath) {
    return res.status(415).json({ error: "Preview not available for this asset yet" });
  }

  res.setHeader("Content-Type", sourceMime(fallback.originalName));
  res.setHeader("Cache-Control", "private, max-age=60");
  return sendFileSafe(res, fallback.storagePath, { notFoundMessage: "Preview source file missing" });
});

app.get("/api/owner/source-files/:sourceFileId/download", async (req, res) => {
  const db = await store.read();
  const sourceFile = db.sourceFiles.find((sf) => sf.id === req.params.sourceFileId);
  if (!sourceFile) return res.status(404).json({ error: "Source file not found" });

  res.setHeader("Content-Type", sourceFile.mimeType || sourceMime(sourceFile.originalName));
  res.setHeader("Content-Disposition", `attachment; filename=\"${sourceFile.originalName}\"`);
  return sendFileSafe(res, sourceFile.storagePath, { notFoundMessage: "Original source file missing" });
});

app.get("/api/library/timeline", async (req, res) => {
  const db = await store.read();

  const result = timelineByDay(db, {
    groupBy: req.query.groupBy === "day_imported" ? "day_imported" : "day_taken",
    type: req.query.type,
    page: normalizePage(req.query.page, 1),
    pageSize: normalizePageSize(req.query.pageSize, 30, 100),
  });

  return res.json({
    ...result,
    items: result.items.map((dayGroup) => ({
      ...dayGroup,
      assets: dayGroup.assets.map((asset) => ({
        ...scrubAsset(asset),
        previewUrl: `/api/owner/assets/${asset.id}/preview`,
      })),
    })),
  });
});

app.get("/api/albums", async (req, res) => {
  const db = await store.read();
  const result = listAlbums(db, {
    page: normalizePage(req.query.page, 1),
    pageSize: normalizePageSize(req.query.pageSize, 50, 200),
  });
  return res.json(result);
});

app.post("/api/albums", async (req, res) => {
  try {
    const album = await store.update((db) => createAlbum(db, req.body ?? {}));
    return res.status(201).json(album);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get("/api/albums/:albumId", async (req, res) => {
  const db = await store.read();
  const album = getAlbum(db, req.params.albumId, {
    page: normalizePage(req.query.page, 1),
    pageSize: normalizePageSize(req.query.pageSize, 100, 500),
  });

  if (!album) return res.status(404).json({ error: "Album not found" });

  return res.json({
    ...album,
    assets: album.assets.map((asset) => ({
      ...scrubAsset(asset),
      previewUrl: `/api/owner/assets/${asset.id}/preview`,
    })),
  });
});

app.patch("/api/albums/:albumId", async (req, res) => {
  try {
    const album = await store.update((db) => updateAlbum(db, req.params.albumId, req.body ?? {}));
    return res.json(album);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.delete("/api/albums/:albumId", async (req, res) => {
  try {
    const album = await store.update((db) =>
      deleteAlbum(db, req.params.albumId, { deleteAssets: asBoolean(req.query.deleteAssets) }),
    );
    return res.json({ deleted: true, albumId: album.id });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/api/albums/:albumId/assets", async (req, res) => {
  try {
    const payload = Array.isArray(req.body?.assetIds) ? req.body.assetIds : [];
    const result = await store.update((db) => addAssetsToAlbum(db, req.params.albumId, payload));
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.delete("/api/albums/:albumId/assets/:assetId", async (req, res) => {
  try {
    const result = await store.update((db) => removeAssetFromAlbum(db, req.params.albumId, req.params.assetId));
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get("/api/jobs/derivatives", async (_req, res) => {
  const db = await store.read();
  const items = listDerivativeJobs(db);
  return res.json({
    items,
    summary: {
      total: items.length,
      queued: items.filter((j) => j.status === "queued").length,
      processing: items.filter((j) => j.status === "processing").length,
      completed: items.filter((j) => j.status === "completed").length,
      failed: items.filter((j) => j.status === "failed").length,
    },
  });
});

app.post("/api/jobs/derivatives/run", async (req, res) => {
  try {
    const limit = normalizePageSize(req.body?.limit, 10, 100);
    const force = asBoolean(req.body?.force, false);
    const staleMs = Number(req.body?.staleMs || 5 * 60_000);
    const result = await store.update((db) => processDerivativeJobs({ db, paths, limit, force, staleMs }));
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get("/api/jobs/derivatives/worker", (_req, res) => {
  return res.json({
    enabled: jobWorkerEnabled,
    intervalMs: jobWorkerIntervalMs,
    running: jobWorkerRunning,
    lastRunAt: jobWorkerLastRunAt,
    lastResult: jobWorkerLastResult,
  });
});

app.post("/api/jobs/derivatives/worker/run", async (_req, res) => {
  try {
    const result = await runDerivativeWorkerTick();
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/api/jobs/derivatives/reset-failed", async (_req, res) => {
  try {
    const result = await store.update((db) => {
      let count = 0;
      db.derivativeJobs.forEach((job) => {
        if (job.status === "failed") {
          job.status = "queued";
          job.attempts = 0;
          job.error = null;
          count++;
        }
      });
      return { resetCount: count };
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get("/api/shares", async (_req, res) => {
  const db = await store.read();
  return res.json({
    items: listShares(db),
  });
});

app.post("/api/shares/albums/:albumId", async (req, res) => {
  try {
    const payload = req.body ?? {};
    const output = await store.update((db) =>
      createAlbumShare(db, req.params.albumId, {
        password: payload.password ?? null,
        expiresAt: payload.expiresAt ?? null,
      }),
    );

    return res.status(201).json({
      shareId: output.share.id,
      token: output.share.token,
      albumId: output.share.albumId,
      expiresAt: output.share.expiresAt,
      requiresPassword: Boolean(output.share.passwordHash),
      shareUrl: `/api/shares/${output.share.token}`,
      publicPageUrl: `/app/share.html?token=${output.share.token}`,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.delete("/api/shares/:shareId", async (req, res) => {
  try {
    const result = await store.update((db) => revokeShare(db, req.params.shareId));
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get("/api/shares/:token", withShareRateLimit, async (req, res) => {
  const db = await store.read();
  const share = getShareByToken(db, req.params.token);
  const access = validateShareAccess(share, sharePassword(req));
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  const { album, assets } = listShareAssets(db, share);
  if (!album) return res.status(404).json({ error: "Album not found" });

  return res.json({
    album: {
      id: album.id,
      name: album.name,
      sharingStatus: album.sharingStatus,
    },
    share: {
      token: share.token,
      expiresAt: share.expiresAt,
      requiresPassword: Boolean(share.passwordHash),
    },
    assets: assets.map((asset) => ({
      ...asset,
      url: asset.hasShareDerivative ? `/api/shares/${share.token}/assets/${asset.id}/file` : null,
    })),
  });
});

app.get("/api/shares/:token/assets/:assetId/file", withShareRateLimit, async (req, res) => {
  const db = await store.read();
  const share = getShareByToken(db, req.params.token);
  const access = validateShareAccess(share, sharePassword(req));
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  const assetInAlbum = db.albumAssets.some((aa) => aa.albumId === share.albumId && aa.assetId === req.params.assetId);
  if (!assetInAlbum) return res.status(404).json({ error: "Asset not found in shared album" });

  const derivative = latestReadyShareDerivative(db, req.params.assetId);
  if (!derivative) return res.status(415).json({ error: "Share derivative not available for this asset yet" });

  res.setHeader("Content-Type", derivative.mimeType || "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=300");
  return sendFileSafe(res, derivative.storagePath, { notFoundMessage: "Shared derivative file missing" });
});

bootstrap()
  .then(() => {
    startDerivativeWorker();
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Alpha API listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to bootstrap", error);
    process.exit(1);
  });
