import test from "node:test";
import assert from "node:assert/strict";
import { createAlbum, addAssetsToAlbum, removeAssetFromAlbum, deleteAlbum } from "../src/lib/albums.js";

function dbFixture() {
  return {
    assets: [{ id: "a1" }, { id: "a2" }],
    sourceFiles: [],
    batches: [],
    imports: [],
    albums: [],
    albumAssets: [],
    shares: [],
  };
}

test("album CRUD helper behavior", () => {
  const db = dbFixture();

  const album = createAlbum(db, { name: "Trip" });
  assert.equal(db.albums.length, 1);

  const addResult = addAssetsToAlbum(db, album.id, ["a1", "a2", "a2"]);
  assert.equal(addResult.added, 2);
  assert.equal(db.albumAssets.length, 2);

  const rm = removeAssetFromAlbum(db, album.id, "a1");
  assert.equal(rm.removed, 1);

  deleteAlbum(db, album.id, { deleteAssets: false });
  assert.equal(db.albums.length, 0);
});
