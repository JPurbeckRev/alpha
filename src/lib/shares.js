import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { latestReadyShareDerivative } from "./derivatives.js";

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${key}`;
}

function verifyPassword(password, stored) {
  if (!stored) return true;
  const [salt, keyHex] = stored.split(":");
  if (!salt || !keyHex) return false;

  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(keyHex, "hex");
  if (actual.length !== expected.length) return false;

  return timingSafeEqual(actual, expected);
}

export function createAlbumShare(db, albumId, { password = null, expiresAt = null } = {}) {
  const album = db.albums.find((a) => a.id === albumId);
  if (!album) throw new Error("Album not found");

  const share = {
    id: randomUUID(),
    albumId,
    token: randomBytes(24).toString("hex"),
    passwordHash: password?.trim() ? hashPassword(password) : null,
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    createdAt: nowIso(),
  };

  db.shares.push(share);
  album.sharingStatus = share.passwordHash ? "link+password" : "link";
  album.updatedAt = nowIso();

  return {
    share,
    album,
  };
}

export function getShareByToken(db, token) {
  return db.shares.find((s) => s.token === token) ?? null;
}

export function validateShareAccess(share, providedPassword = null) {
  if (!share) return { ok: false, status: 404, error: "Share not found" };

  if (share.expiresAt && new Date(share.expiresAt).getTime() <= Date.now()) {
    return { ok: false, status: 410, error: "Share expired" };
  }

  if (share.passwordHash) {
    if (!providedPassword || !verifyPassword(providedPassword, share.passwordHash)) {
      return { ok: false, status: 401, error: "Password required or invalid" };
    }
  }

  return { ok: true };
}

export function listShareAssets(db, share) {
  const album = db.albums.find((a) => a.id === share.albumId);
  if (!album) return { album: null, assets: [] };

  const assetIds = db.albumAssets.filter((aa) => aa.albumId === album.id).map((aa) => aa.assetId);
  const assets = db.assets.filter((a) => assetIds.includes(a.id));

  return {
    album,
    assets: assets.map((asset) => {
      const derivative = latestReadyShareDerivative(db, asset.id);
      return {
        id: asset.id,
        type: asset.type,
        takenAt: asset.takenAt,
        importedAt: asset.importedAt,
        cameraModel: asset.cameraModel,
        hasShareDerivative: Boolean(derivative),
      };
    }),
  };
}
