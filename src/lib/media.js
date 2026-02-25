import path from "node:path";

const RAW_EXTENSIONS = new Set([".arw"]);
const JPEG_EXTENSIONS = new Set([".jpg", ".jpeg"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mts"]);

export function extensionOf(fileName = "") {
  return path.extname(fileName).toLowerCase();
}

export function mediaKindFromExtension(ext = "") {
  if (RAW_EXTENSIONS.has(ext) || JPEG_EXTENSIONS.has(ext)) return "photo";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return "unknown";
}

export function isRaw(ext = "") {
  return RAW_EXTENSIONS.has(ext);
}

export function isJpeg(ext = "") {
  return JPEG_EXTENSIONS.has(ext);
}

export function pairKeyFromName(fileName = "") {
  return path.parse(fileName).name.toLowerCase();
}

export function formatKey(ext = "") {
  switch (ext) {
    case ".arw":
      return "ARW";
    case ".jpg":
    case ".jpeg":
      return "JPEG";
    case ".mp4":
      return "MP4";
    case ".mts":
      return "MTS";
    default:
      return "UNKNOWN";
  }
}

export function formatBreakdown(files = []) {
  const out = {
    JPEG: 0,
    ARW: 0,
    MP4: 0,
    MTS: 0,
    UNKNOWN: 0,
  };

  for (const file of files) {
    const key = formatKey(file.ext);
    out[key] = (out[key] ?? 0) + 1;
  }

  return out;
}

export function computeShotCount(files = []) {
  const unique = files.filter((f) => !f.duplicate);
  const videos = unique.filter((f) => f.kind === "video").length;

  const photos = unique.filter((f) => f.kind === "photo");
  const grouped = new Map();

  for (const file of photos) {
    const key = file.pairKey ?? "";
    const existing = grouped.get(key) ?? { hasRaw: false, hasJpeg: false, singles: 0 };

    if (file.raw) existing.hasRaw = true;
    else if (file.jpeg) existing.hasJpeg = true;
    else existing.singles += 1;

    grouped.set(key, existing);
  }

  let shots = videos;
  for (const entry of grouped.values()) {
    if (entry.hasRaw && entry.hasJpeg) {
      shots += 1;
    } else {
      shots += (entry.hasRaw ? 1 : 0) + (entry.hasJpeg ? 1 : 0) + entry.singles;
    }
  }

  return shots;
}
