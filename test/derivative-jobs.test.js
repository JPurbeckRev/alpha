import test from "node:test";
import assert from "node:assert/strict";
import { queueDerivativeJobsForAssets } from "../src/lib/derivative-jobs.js";

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
