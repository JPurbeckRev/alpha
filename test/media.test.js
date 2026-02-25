import test from "node:test";
import assert from "node:assert/strict";
import { computeShotCount, extensionOf, mediaKindFromExtension } from "../src/lib/media.js";

test("media extension + kind detection", () => {
  assert.equal(extensionOf("foo.JPG"), ".jpg");
  assert.equal(mediaKindFromExtension(".arw"), "photo");
  assert.equal(mediaKindFromExtension(".mp4"), "video");
  assert.equal(mediaKindFromExtension(".weird"), "unknown");
});

test("RAW+JPEG pair counts as one logical shot", () => {
  const files = [
    { duplicate: false, kind: "photo", raw: true, jpeg: false, pairKey: "a" },
    { duplicate: false, kind: "photo", raw: false, jpeg: true, pairKey: "a" },
    { duplicate: false, kind: "video", raw: false, jpeg: false, pairKey: "v1" },
  ];

  assert.equal(computeShotCount(files), 2);
});
