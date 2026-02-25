import test from "node:test";
import assert from "node:assert/strict";
import { createAlbumShare, listShareAssets, listShares, revokeShare, validateShareAccess } from "../src/lib/shares.js";

function dbFixture() {
  return {
    assets: [{ id: "asset-1", type: "photo", takenAt: null, importedAt: null, cameraModel: null, sourceFileIds: [] }],
    sourceFiles: [],
    derivatives: [
      {
        id: "d1",
        assetId: "asset-1",
        type: "share",
        status: "ready",
        storagePath: "x",
        mimeType: "image/jpeg",
        createdAt: new Date().toISOString(),
      },
    ],
    batches: [],
    imports: [],
    albums: [{ id: "album-1", name: "A", sharingStatus: "off", updatedAt: new Date().toISOString() }],
    albumAssets: [{ id: "aa1", albumId: "album-1", assetId: "asset-1" }],
    shares: [],
  };
}

test("share creation + password validation", () => {
  const db = dbFixture();
  const out = createAlbumShare(db, "album-1", { password: "secret" });

  assert.equal(Boolean(out.share.token), true);

  const denied = validateShareAccess(out.share, "wrong");
  assert.equal(denied.ok, false);
  assert.equal(denied.status, 401);

  const allowed = validateShareAccess(out.share, "secret");
  assert.equal(allowed.ok, true);
});

test("share listing uses derivative availability", () => {
  const db = dbFixture();
  const { share } = createAlbumShare(db, "album-1", {});
  const payload = listShareAssets(db, share);

  assert.equal(payload.assets.length, 1);
  assert.equal(payload.assets[0].hasShareDerivative, true);
});

test("share list + revoke behavior", () => {
  const db = dbFixture();
  const created = createAlbumShare(db, "album-1", {});

  const listed = listShares(db);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].albumName, "A");

  const revoked = revokeShare(db, created.share.id);
  assert.equal(revoked.revoked, true);
  assert.equal(db.shares.length, 0);
  assert.equal(db.albums[0].sharingStatus, "off");
});
