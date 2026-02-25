import test from "node:test";
import assert from "node:assert/strict";
import {
  queueDerivativeJobsForAssets,
  recoverStaleDerivativeJobs,
  requiredBinaryForTarget,
} from "../src/lib/derivative-jobs.js";

function dbFixture() {
  return {
    assets: [],
    sourceFiles: [],
    derivatives: [],
    derivativeJobs: [],
    batches: [],
    imports: [],
    albums: [],
    albumAssets: [],
    shares: [],
  };
}

test("required converter mapping is explicit for supported targets", () => {
  assert.equal(requiredBinaryForTarget("mp4"), "ffmpeg");
  assert.equal(requiredBinaryForTarget("jpeg"), "ffmpeg");
  assert.equal(requiredBinaryForTarget("unknown"), null);
});

test("queue derivative jobs for unsupported source formats", () => {
  const db = dbFixture();

  const sourceFiles = [
    { id: "s1", originalName: "A.MTS" },
    { id: "s2", originalName: "B.ARW" },
  ];

  const assets = [
    { id: "a1", sourceFileIds: ["s1"] },
    { id: "a2", sourceFileIds: ["s2"] },
  ];

  const out = queueDerivativeJobsForAssets({ db, assets, sourceFiles, importId: "imp-1" });

  assert.equal(out.queued, 2);
  assert.equal(db.derivativeJobs.length, 2);
  assert.equal(db.derivativeJobs[0].status, "queued");
});

test("recover stale processing jobs back into queue", () => {
  const db = dbFixture();
  const now = Date.now();

  db.derivativeJobs.push(
    {
      id: "old-processing",
      status: "processing",
      updatedAt: new Date(now - 10 * 60_000).toISOString(),
      createdAt: new Date(now - 11 * 60_000).toISOString(),
      nextRunAt: null,
      attempts: 1,
    },
    {
      id: "fresh-processing",
      status: "processing",
      updatedAt: new Date(now - 30_000).toISOString(),
      createdAt: new Date(now - 60_000).toISOString(),
      nextRunAt: null,
      attempts: 1,
    },
  );

  const recovered = recoverStaleDerivativeJobs(db, { staleMs: 5 * 60_000 });
  assert.equal(recovered, 1);
  assert.equal(db.derivativeJobs[0].status, "queued");
  assert.equal(db.derivativeJobs[1].status, "processing");
});
