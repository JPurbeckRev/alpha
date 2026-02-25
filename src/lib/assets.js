import fs from "node:fs/promises";
import { pathExists } from "./fs-utils.js";

export async function deleteAsset(db, assetId, { deleteSourceFiles = true } = {}) {
  const assetIdx = db.assets.findIndex((a) => a.id === assetId);
  if (assetIdx < 0) throw new Error("Asset not found");

  const asset = db.assets[assetIdx];

  // 1. Remove from albums
  db.albumAssets = db.albumAssets.filter((aa) => aa.assetId !== assetId);

  // 2. Remove derivatives
  const assetDerivatives = db.derivatives.filter((d) => d.assetId === assetId);
  for (const derivative of assetDerivatives) {
    if (derivative.storagePath && await pathExists(derivative.storagePath)) {
      try {
        await fs.unlink(derivative.storagePath);
      } catch (e) {
        console.error(`Failed to delete derivative file: ${derivative.storagePath}`, e);
      }
    }
  }
  db.derivatives = db.derivatives.filter((d) => d.assetId !== assetId);

  // 3. Remove jobs
  db.derivativeJobs = db.derivativeJobs.filter((j) => j.assetId !== assetId);

  // 4. Remove source files
  const sourceFiles = db.sourceFiles.filter((sf) => asset.sourceFileIds.includes(sf.id));
  if (deleteSourceFiles) {
    for (const sf of sourceFiles) {
      if (sf.storagePath && await pathExists(sf.storagePath)) {
        try {
          await fs.unlink(sf.storagePath);
        } catch (e) {
          console.error(`Failed to delete source file: ${sf.storagePath}`, e);
        }
      }
    }
  }
  
  const sourceFileIds = new Set(asset.sourceFileIds);
  db.sourceFiles = db.sourceFiles.filter((sf) => !sourceFileIds.has(sf.id));

  // 5. Remove asset itself
  db.assets.splice(assetIdx, 1);

  return { assetId, success: true };
}
