import test from "node:test";
import assert from "node:assert/strict";
import { queryAssets, timelineByDay } from "../src/lib/library.js";

function fixture() {
  const now = new Date().toISOString();
  return {
    assets: [
      { id: "asset1", type: "photo", takenAt: "2026-02-20T10:00:00.000Z", importedAt: now, cameraModel: "Sony", sourceFileIds: ["s1"] },
      { id: "asset2", type: "video", takenAt: "2026-02-20T11:00:00.000Z", importedAt: now, cameraModel: "Sony", sourceFileIds: ["s2"] },
      { id: "asset3", type: "photo", takenAt: "2026-02-21T10:00:00.000Z", importedAt: now, cameraModel: "Canon", sourceFileIds: ["s3"] },
    ],
    sourceFiles: [
      { id: "s1", originalName: "IMG_1.ARW", raw: true, jpeg: false },
      { id: "s2", originalName: "VID_1.MP4", raw: false, jpeg: false },
      { id: "s3", originalName: "IMG_2.JPG", raw: false, jpeg: true },
    ],
    batches: [],
    imports: [],
    albums: [],
    albumAssets: [],
    shares: [],
  };
}

test("queryAssets filters by type and camera model", () => {
  const db = fixture();
  const result = queryAssets(db, { type: "photo", cameraModel: "sony" });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, "asset1");
});

test("timeline groups by day", () => {
  const db = fixture();
  const result = timelineByDay(db, { groupBy: "day_taken" });
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].count >= 1, true);
});
