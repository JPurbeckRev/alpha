import fs from "node:fs/promises";
import path from "node:path";

const outDir = path.join(process.cwd(), "uat", "sample_media");

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const files = [
    ["IMG_1001.ARW", "fake-raw-1001"],
    ["IMG_1001.JPG", "fake-jpeg-1001"],
    ["IMG_1002.JPG", "fake-jpeg-1002"],
    ["VID_2001.MP4", "fake-video-2001"],
    ["VID_2002.MTS", "fake-video-2002"],
    ["DUPLICATE_1.JPG", "same-content"],
    ["DUPLICATE_2.JPG", "same-content"],
  ];

  for (const [name, content] of files) {
    await fs.writeFile(path.join(outDir, name), content, "utf8");
  }

  console.log(`UAT sample media created in: ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
