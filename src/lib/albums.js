import { randomUUID } from "node:crypto";
import { paginate } from "./paginate.js";
import { hydrateAssets } from "./library.js";

function nowIso() {
  return new Date().toISOString();
}

function validateName(name) {
  if (!name?.trim()) throw new Error("Album name is required");
  return name.trim();
}

function withAlbumCounts(db, albums) {
  const counts = new Map();
  for (const aa of db.albumAssets) {
    counts.set(aa.albumId, (counts.get(aa.albumId) ?? 0) + 1);
  }

  return albums.map((album) => ({
    ...album,
    assetCount: counts.get(album.id) ?? 0,
  }));
}

export function listAlbums(db, { page = 1, pageSize = 50 } = {}) {
  const sorted = [...db.albums].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return paginate(withAlbumCounts(db, sorted), page, pageSize);
}

export function getAlbum(db, albumId, { page = 1, pageSize = 100 } = {}) {
  const album = db.albums.find((a) => a.id === albumId);
  if (!album) return null;

  const assetIds = db.albumAssets.filter((aa) => aa.albumId === albumId).map((aa) => aa.assetId);
  const assets = hydrateAssets(db).filter((asset) => assetIds.includes(asset.id));
  const paged = paginate(assets, page, pageSize);

  return {
    ...album,
    assetCount: assetIds.length,
    assets: paged.items,
    pagination: paged.pagination,
  };
}

export function createAlbum(db, { name, sortPolicy = "manual", sharingStatus = "off" }) {
  const album = {
    id: randomUUID(),
    name: validateName(name),
    coverAssetId: null,
    sortPolicy,
    sharingStatus,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  db.albums.push(album);
  return album;
}

export function updateAlbum(db, albumId, patch = {}) {
  const album = db.albums.find((a) => a.id === albumId);
  if (!album) throw new Error("Album not found");

  if (patch.name !== undefined) album.name = validateName(patch.name);
  if (patch.sortPolicy !== undefined) album.sortPolicy = patch.sortPolicy;
  if (patch.sharingStatus !== undefined) album.sharingStatus = patch.sharingStatus;
  if (patch.coverAssetId !== undefined) album.coverAssetId = patch.coverAssetId;

  album.updatedAt = nowIso();
  return album;
}

export function deleteAlbum(db, albumId, { deleteAssets = false } = {}) {
  const idx = db.albums.findIndex((a) => a.id === albumId);
  if (idx < 0) throw new Error("Album not found");

  const removed = db.albums.splice(idx, 1)[0];
  const albumAssetRows = db.albumAssets.filter((aa) => aa.albumId === albumId);
  db.albumAssets = db.albumAssets.filter((aa) => aa.albumId !== albumId);

  if (deleteAssets) {
    const assetIds = new Set(albumAssetRows.map((aa) => aa.assetId));
    db.assets = db.assets.filter((a) => !assetIds.has(a.id));
    db.sourceFiles = db.sourceFiles.filter((sf) => !assetIds.has(sf.assetId));
    db.albumAssets = db.albumAssets.filter((aa) => !assetIds.has(aa.assetId));
  }

  return removed;
}

export function addAssetsToAlbum(db, albumId, assetIds = []) {
  const album = db.albums.find((a) => a.id === albumId);
  if (!album) throw new Error("Album not found");

  const knownAssets = new Set(db.assets.map((a) => a.id));
  const existing = new Set(db.albumAssets.filter((aa) => aa.albumId === albumId).map((aa) => aa.assetId));

  let added = 0;
  for (const assetId of assetIds) {
    if (!knownAssets.has(assetId) || existing.has(assetId)) continue;

    db.albumAssets.push({
      id: randomUUID(),
      albumId,
      assetId,
    });
    existing.add(assetId);
    added += 1;
  }

  if (!album.coverAssetId) {
    album.coverAssetId = assetIds.find((id) => knownAssets.has(id)) ?? null;
  }

  album.updatedAt = nowIso();
  return { added, album };
}

export function removeAssetFromAlbum(db, albumId, assetId) {
  const album = db.albums.find((a) => a.id === albumId);
  if (!album) throw new Error("Album not found");

  const before = db.albumAssets.length;
  db.albumAssets = db.albumAssets.filter((aa) => !(aa.albumId === albumId && aa.assetId === assetId));
  const removed = before - db.albumAssets.length;

  if (album.coverAssetId === assetId) {
    const fallback = db.albumAssets.find((aa) => aa.albumId === albumId);
    album.coverAssetId = fallback?.assetId ?? null;
  }

  album.updatedAt = nowIso();
  return { removed };
}
