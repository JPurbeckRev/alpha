import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/lib/store.js";
import { ensureDir } from "../src/lib/fs-utils.js";
import { executeImport, stageBatchFromUploads } from "../src/lib/importer.js";

async function writeFakeFile(dir, name, content) {
  const filePath = path.join(dir, name);
  await fs.writeFile(filePath, content, "utf8");
  const stats = await fs.stat(filePath);
  return {
    path: filePath,
    originalname: name,
    filename: name,
    mimetype: "application/octet-stream",
    size: stats.size,
  };
}

test("stage + import flow creates assets and import log", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "alpha-test-"));
  const paths = {
    storageRoot: root,
    tempUploads: path.join(root, "tmp"),
    stagingRoot: path.join(root, "staging"),
    originalsRoot: path.join(root, "originals"),
    derivativesRoot: path.join(root, "derivatives"),
    dbPath: path.join(root, "db.json"),
  };

  await ensureDir(paths.tempUploads);
  await ensureDir(paths.stagingRoot);
  await ensureDir(paths.originalsRoot);
  await ensureDir(paths.derivativesRoot);

  const store = new JsonStore(paths.dbPath);
  await store.init();

  const files = [
    await writeFakeFile(paths.tempUploads, "IMG_0001.ARW", "raw-data"),
    await writeFakeFile(paths.tempUploads, "IMG_0001.JPG", "jpeg-data"),
    await writeFakeFile(paths.tempUploads, "VID_0001.MP4", "video-data"),
  ];

  const batch = await stageBatchFromUploads({
    multerFiles: files,
    batchId: "batch-1",
    paths,
    store,
  });

  assert.equal(batch.summary.totalFiles, 3);
  assert.equal(batch.summary.shotsDetected, 2);

  const importLog = await executeImport({
    batchId: "batch-1",
    createAlbums: true,
    rule: "day_imported",
    albumName: null,
    paths,
    store,
  });

  assert.equal(importLog.counts.totalFilesInBatch, 3);
  assert.equal(importLog.counts.logicalAssetsCreated, 2);
  assert.equal(importLog.counts.albumsCreated, 1);
  assert.equal(importLog.counts.derivativesReady, 2);

  const db = await store.read();
  assert.equal(db.assets.length, 2);
  assert.equal(db.sourceFiles.length, 3);
  assert.equal(db.derivatives.length, 2);
});
