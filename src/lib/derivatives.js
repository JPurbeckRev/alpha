import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureDir } from "./fs-utils.js";

const EXT_TO_MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
};

function ext(fileName = "") {
  return path.extname(fileName).toLowerCase();
}

function chooseShareSource(sourceFiles = []) {
  const jpeg = sourceFiles.find((sf) => [".jpg", ".jpeg"].includes(ext(sf.originalName)));
  if (jpeg) return { source: jpeg, outExt: ".jpg", format: "jpeg" };

  const png = sourceFiles.find((sf) => ext(sf.originalName) === ".png");
  if (png) return { source: png, outExt: ".png", format: "png" };

  const webp = sourceFiles.find((sf) => ext(sf.originalName) === ".webp");
  if (webp) return { source: webp, outExt: ".webp", format: "webp" };

  const gif = sourceFiles.find((sf) => ext(sf.originalName) === ".gif");
  if (gif) return { source: gif, outExt: ".gif", format: "gif" };

  const mp4 = sourceFiles.find((sf) => ext(sf.originalName) === ".mp4");
  if (mp4) return { source: mp4, outExt: ".mp4", format: "mp4" };

  return null;
}

export async function generateDerivativesForAssets({ assets, sourceFiles, derivativesRoot }) {
  await ensureDir(derivativesRoot);

  const bySourceId = new Map(sourceFiles.map((sf) => [sf.id, sf]));

  const derivatives = [];
  const counts = {
    ready: 0,
    unavailable: 0,
  };

  for (const asset of assets) {
    const owned = asset.sourceFileIds.map((id) => bySourceId.get(id)).filter(Boolean);
    const selected = chooseShareSource(owned);

    if (!selected) {
      derivatives.push({
        id: randomUUID(),
        assetId: asset.id,
        type: "share",
        format: null,
        mimeType: null,
        storagePath: null,
        status: "unavailable",
        reason: "No web-friendly source file available for derivative generation yet",
        createdAt: new Date().toISOString(),
      });
      counts.unavailable += 1;
      continue;
    }

    const derivativeName = `${asset.id}-share${selected.outExt}`;
    const derivativePath = path.join(derivativesRoot, derivativeName);
    await fs.copyFile(selected.source.storagePath, derivativePath);

    derivatives.push({
      id: randomUUID(),
      assetId: asset.id,
      type: "share",
      format: selected.format,
      mimeType: EXT_TO_MIME[selected.outExt] ?? "application/octet-stream",
      storagePath: derivativePath,
      status: "ready",
      reason: null,
      createdAt: new Date().toISOString(),
    });
    counts.ready += 1;
  }

  return {
    derivatives,
    counts,
  };
}

export function latestReadyShareDerivative(db, assetId) {
  const candidates = db.derivatives
    .filter((d) => d.assetId === assetId && d.type === "share" && d.status === "ready")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return candidates[0] ?? null;
}
