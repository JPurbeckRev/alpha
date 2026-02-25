import express from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
  if (e === ".mp4") return "video/mp4";
  if (e === ".mts") return "video/mp2t";
  if (e === ".arw") return "image/x-sony-arw";
  return "application/octet-stream";
}

function pickOwnerPreviewSource(sourceFiles = []) {
  const jpeg = sourceFiles.find((sf) => [".jpg", ".jpeg"].includes(ext(sf.originalName)));
  if (jpeg) return jpeg;

  const mp4 = sourceFiles.find((sf) => ext(sf.originalName) === ".mp4");
  if (mp4) return mp4;

  return null;
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
  return res.sendFile(filePath, (error) => {
    if (!error) return;
    if (res.headersSent) return;

    if (error?.statusCode === 404 || error?.code === "ENOENT") {
      return res.status(404).json({ error: notFoundMessage });
    }

    return res.status(500).json({ error: "Failed to read file" });
  });
}

function asBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
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
app.use("/app", express.static(path.join(paths.root, "app")));
app.use("/uat", express.static(path.join(paths.root, "app")));
app.use("/docs", express.static(path.join(paths.root, "docs")));

app.get("/", (_req, res) => res.redirect("/app"));
app.get("/app", (_req, res) => res.sendFile(path.join(paths.root, "app", "index.html")));
app.get("/uat", (_req, res) => res.sendFile(path.join(paths.root, "app", "index.html")));

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
    },
  });
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
