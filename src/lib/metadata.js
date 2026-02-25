import fs from "node:fs/promises";
import exifr from "exifr";

function normalizeDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function extractMetadata(filePath, kind) {
  let takenAt = null;
  let cameraModel = null;
  let metadataSource = "none";

  try {
    const parsed = await exifr.parse(filePath, ["DateTimeOriginal", "CreateDate", "Model"]);
    takenAt = normalizeDate(parsed?.DateTimeOriginal ?? parsed?.CreateDate ?? null);
    cameraModel = parsed?.Model ?? null;
    if (takenAt || cameraModel) metadataSource = "exif";
  } catch {
    // ignore parse errors, fall through to file timestamp fallback
  }

  if (!takenAt) {
    try {
      const stats = await fs.stat(filePath);
      takenAt = normalizeDate(stats.birthtime ?? stats.mtime ?? null);
      if (takenAt) metadataSource = metadataSource === "none" ? "filesystem" : metadataSource;
    } catch {
      // ignored
    }
  }

  return {
    kind,
    takenAt,
    cameraModel,
    metadataSource,
  };
}
