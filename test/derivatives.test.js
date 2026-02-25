import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateDerivativesForAssets } from "../src/lib/derivatives.js";

test("generate derivatives for jpeg/mp4 source files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "alpha-deriv-"));
  const derivativesRoot = path.join(root, "derivatives");
  const originals = path.join(root, "orig");
  await fs.mkdir(originals, { recursive: true });

  const jpgPath = path.join(originals, "img.jpg");
  await fs.writeFile(jpgPath, "jpg", "utf8");

  const assets = [{ id: "a1", sourceFileIds: ["s1"] }];
  const sourceFiles = [{ id: "s1", originalName: "IMG_1.JPG", storagePath: jpgPath }];

  const out = await generateDerivativesForAssets({ assets, sourceFiles, derivativesRoot });

  assert.equal(out.counts.ready, 1);
  assert.equal(out.counts.unavailable, 0);
  assert.equal(out.derivatives[0].status, "ready");
});
