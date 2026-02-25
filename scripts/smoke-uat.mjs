import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const base = "http://localhost:8787";

function json(url, init) {
  return fetch(url, init).then(async (res) => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(JSON.stringify(body));
    return body;
  });
}

async function main() {
  const health = await json(`${base}/api/health`);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "alpha-smoke-"));
  const nonce = Date.now().toString();
  const samples = [
    ["IMG_1001.ARW", `raw-sample-${nonce}`],
    ["IMG_1001.JPG", `jpeg-sample-${nonce}`],
    ["VID_2001.MP4", `video-sample-${nonce}`],
  ];

  const form = new FormData();
  for (const [name, content] of samples) {
    const full = path.join(tmpDir, name);
    await fs.writeFile(full, content, "utf8");
    const buf = await fs.readFile(full);
    form.append("files", new Blob([buf]), name);
  }

  const uploadRes = await fetch(`${base}/api/staging/upload`, { method: "POST", body: form });
  const upload = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(JSON.stringify(upload));

  const imp = await json(`${base}/api/imports/${upload.batchId}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ createAlbums: true, rule: "new_name", albumName: "Smoke Album" }),
  });

  const timeline = await json(`${base}/api/library/timeline?groupBy=day_imported`);
  const albums = await json(`${base}/api/albums`);
  const assets = await json(`${base}/api/library/assets?page=1&pageSize=10`);

  console.log(
    JSON.stringify(
      {
        health: health.ok,
        batchId: upload.batchId,
        importedAssets: imp.counts.logicalAssetsCreated,
        timelineGroups: timeline.pagination.total,
        albumCount: albums.pagination.total,
        assetCount: assets.pagination.total,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
