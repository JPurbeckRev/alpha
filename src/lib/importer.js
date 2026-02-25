import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  computeShotCount,
  extensionOf,
  formatBreakdown,
  isJpeg,
  isRaw,
  mediaKindFromExtension,
  pairKeyFromName,
} from "./media.js";
import { ensureDir, pathExists, safeMoveFile } from "./fs-utils.js";
import { sha256File } from "./hash.js";
import { extractMetadata } from "./metadata.js";

function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
}

function dayStamp(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "unknown-day";
  return d.toISOString().slice(0, 10);
}

function classifyFile(fileName) {
  const ext = extensionOf(fileName);
  return {
    ext,
    kind: mediaKindFromExtension(ext),
    raw: isRaw(ext),
    jpeg: isJpeg(ext),
    pairKey: pairKeyFromName(fileName),
  };
}

function buildLogicalAssets(sourceFiles, importedAtIso) {
  const assets = [];
  const photos = sourceFiles.filter((f) => f.kind === "photo");
  const videos = sourceFiles.filter((f) => f.kind === "video");

  const grouped = new Map();
  for (const file of photos) {
    const key = file.pairKey || file.id;
    const existing = grouped.get(key) ?? [];
    existing.push(file);
    grouped.set(key, existing);
  }

  for (const files of grouped.values()) {
    const raw = files.find((f) => f.raw);
    const jpeg = files.find((f) => f.jpeg);

    if (raw && jpeg) {
      assets.push({
        id: randomUUID(),
        type: "photo",
        takenAt: raw.takenAt ?? jpeg.takenAt ?? null,
        importedAt: importedAtIso,
        cameraModel: raw.cameraModel ?? jpeg.cameraModel ?? null,
        sourceFileIds: [raw.id, jpeg.id],
        primaryChecksum: raw.checksum,
      });
      continue;
    }

    for (const file of files) {
      assets.push({
        id: randomUUID(),
        type: "photo",
        takenAt: file.takenAt ?? null,
        importedAt: importedAtIso,
        cameraModel: file.cameraModel ?? null,
        sourceFileIds: [file.id],
        primaryChecksum: file.checksum,
      });
    }
  }

  for (const video of videos) {
    assets.push({
      id: randomUUID(),
      type: "video",
      takenAt: video.takenAt ?? null,
      importedAt: importedAtIso,
      cameraModel: video.cameraModel ?? null,
      sourceFileIds: [video.id],
      primaryChecksum: video.checksum,
    });
  }

  return assets;
}

function createAlbumsForAssets({ assets, rule, albumName, importedAtIso }) {
  if (assets.length === 0) return { albums: [], albumAssets: [] };

  const groups = new Map();

  if (rule === "new_name") {
    groups.set(albumName?.trim() || "Untitled Album", assets);
  } else if (rule === "day_taken") {
    for (const asset of assets) {
      const key = dayStamp(asset.takenAt);
      const existing = groups.get(key) ?? [];
      existing.push(asset);
      groups.set(key, existing);
    }
  } else {
    const key = dayStamp(importedAtIso);
    groups.set(key, assets);
  }

  const albums = [];
  const albumAssets = [];

  for (const [name, groupAssets] of groups.entries()) {
    const albumId = randomUUID();
    albums.push({
      id: albumId,
      name: rule === "new_name" ? name : `${rule === "day_taken" ? "Taken" : "Imported"} ${name}`,
      coverAssetId: groupAssets[0]?.id ?? null,
      sortPolicy: rule,
      sharingStatus: "off",
      createdAt: importedAtIso,
      updatedAt: importedAtIso,
    });

    for (const asset of groupAssets) {
      albumAssets.push({
        id: randomUUID(),
        albumId,
        assetId: asset.id,
      });
    }
  }

  return { albums, albumAssets };
}

export async function stageBatchFromUploads({ multerFiles, batchId, paths, store }) {
  if (!multerFiles?.length) {
    throw new Error("No files uploaded");
  }

  const stagedAt = new Date().toISOString();
  const stagingBatchDir = path.join(paths.stagingRoot, batchId);
  await ensureDir(stagingBatchDir);

  const db = await store.read();
  const existingChecksums = new Set(db.sourceFiles.map((f) => f.checksum));
  const seenChecksums = new Set();

  const files = [];

  for (const uploadFile of multerFiles) {
    const originalName = sanitizeFileName(uploadFile.originalname || uploadFile.filename);
    const derived = classifyFile(originalName);
    const checksum = await sha256File(uploadFile.path);
    const destinationName = `${checksum}-${Date.now()}-${Math.floor(Math.random() * 1000)}${derived.ext}`;
    const stagingPath = path.join(stagingBatchDir, destinationName);

    await safeMoveFile(uploadFile.path, stagingPath);

    const duplicate = existingChecksums.has(checksum) || seenChecksums.has(checksum);
    seenChecksums.add(checksum);

    const metadata = await extractMetadata(stagingPath, derived.kind);

    files.push({
      id: randomUUID(),
      originalName,
      ext: derived.ext,
      kind: derived.kind,
      raw: derived.raw,
      jpeg: derived.jpeg,
      pairKey: derived.pairKey,
      mimeType: uploadFile.mimetype,
      size: uploadFile.size,
      checksum,
      duplicate,
      stagingPath,
      takenAt: metadata.takenAt,
      cameraModel: metadata.cameraModel,
      metadataSource: metadata.metadataSource,
      uploadedAt: stagedAt,
    });
  }

  const summary = {
    totalFiles: files.length,
    duplicateCount: files.filter((f) => f.duplicate).length,
    formats: formatBreakdown(files),
    shotsDetected: computeShotCount(files),
    missingTakenAtCount: files.filter((f) => !f.takenAt).length,
  };

  const batch = {
    id: batchId,
    status: "staged",
    createdAt: stagedAt,
    completedAt: null,
    files,
    summary,
  };

  db.batches.push(batch);
  await store.write(db);

  return batch;
}

export async function executeImport({ batchId, createAlbums, rule, albumName, paths, store }) {
  return store.update(async (db) => {
    const batch = db.batches.find((b) => b.id === batchId);
    if (!batch) throw new Error("Batch not found");
    if (batch.status !== "staged") throw new Error(`Batch status is ${batch.status}; cannot import`);

    const importedAtIso = new Date().toISOString();
    const importId = randomUUID();

    await ensureDir(paths.originalsRoot);

    const importable = batch.files.filter((f) => !f.duplicate);
    const importedSourceFiles = [];

    for (const file of importable) {
      const destinationPath = path.join(paths.originalsRoot, `${file.checksum}${file.ext}`);
      const alreadyExists = await pathExists(destinationPath);

      if (!alreadyExists) {
        await safeMoveFile(file.stagingPath, destinationPath);
      } else if (await pathExists(file.stagingPath)) {
        await fs.unlink(file.stagingPath);
      }

      importedSourceFiles.push({
        id: randomUUID(),
        assetId: null,
        batchId,
        originalName: file.originalName,
        ext: file.ext,
        kind: file.kind,
        raw: file.raw,
        jpeg: file.jpeg,
        pairKey: file.pairKey,
        checksum: file.checksum,
        size: file.size,
        mimeType: file.mimeType,
        storagePath: destinationPath,
        takenAt: file.takenAt,
        cameraModel: file.cameraModel ?? null,
        metadataSource: file.metadataSource ?? "none",
        importedAt: importedAtIso,
      });
    }

    const assets = buildLogicalAssets(importedSourceFiles, importedAtIso);
    const assetBySourceId = new Map();
    for (const asset of assets) {
      for (const sourceId of asset.sourceFileIds) {
        assetBySourceId.set(sourceId, asset.id);
      }
    }

    for (const sourceFile of importedSourceFiles) {
      sourceFile.assetId = assetBySourceId.get(sourceFile.id) ?? null;
    }

    let albums = [];
    let albumAssets = [];

    if (createAlbums) {
      const grouped = createAlbumsForAssets({
        assets,
        rule,
        albumName,
        importedAtIso,
      });
      albums = grouped.albums;
      albumAssets = grouped.albumAssets;
    }

    const importLog = {
      id: importId,
      batchId,
      createdAt: importedAtIso,
      albumRule: createAlbums ? rule : "none",
      albumName: createAlbums ? albumName ?? null : null,
      counts: {
        totalFilesInBatch: batch.files.length,
        duplicatesSkipped: batch.files.filter((f) => f.duplicate).length,
        sourceFilesImported: importedSourceFiles.length,
        logicalAssetsCreated: assets.length,
        albumsCreated: albums.length,
        failedFiles: 0,
      },
      createdAlbumIds: albums.map((a) => a.id),
      notes: [],
    };

    db.sourceFiles.push(...importedSourceFiles);
    db.assets.push(...assets);
    db.albums.push(...albums);
    db.albumAssets.push(...albumAssets);
    db.imports.push(importLog);

    batch.status = "imported";
    batch.completedAt = importedAtIso;
    batch.importId = importId;

    return importLog;
  });
}
