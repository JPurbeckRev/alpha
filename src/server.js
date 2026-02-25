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
import { queryAssets, timelineByDay } from "./lib/library.js";
import {
  addAssetsToAlbum,
  createAlbum,
  deleteAlbum,
  getAlbum,
  listAlbums,
  removeAssetFromAlbum,
  updateAlbum,
} from "./lib/albums.js";

const app = express();
const port = Number(process.env.PORT || 8787);

const store = new JsonStore(paths.dbPath);

function asBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

async function bootstrap() {
  await ensureDir(paths.storageRoot);
  await ensureDir(paths.tempUploads);
  await ensureDir(paths.stagingRoot);
  await ensureDir(paths.originalsRoot);
  await store.init();
}

const upload = multer({ dest: paths.tempUploads });

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/uat", express.static(path.join(paths.root, "uat")));
app.use("/docs", express.static(path.join(paths.root, "docs")));

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

app.get("/api/library/summary", async (_req, res) => {
  const db = await store.read();

  return res.json({
    assets: db.assets.length,
    sourceFiles: db.sourceFiles.length,
    albums: db.albums.length,
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

  return res.json(result);
});

app.get("/api/library/timeline", async (req, res) => {
  const db = await store.read();

  const result = timelineByDay(db, {
    groupBy: req.query.groupBy === "day_imported" ? "day_imported" : "day_taken",
    type: req.query.type,
    page: normalizePage(req.query.page, 1),
    pageSize: normalizePageSize(req.query.pageSize, 30, 100),
  });

  return res.json(result);
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
  return res.json(album);
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

bootstrap()
  .then(() => {
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
