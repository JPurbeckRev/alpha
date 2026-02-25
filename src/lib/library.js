import { paginate } from "./paginate.js";

function sortByDateDesc(a, b, field) {
  const aTime = new Date(a[field] ?? 0).getTime();
  const bTime = new Date(b[field] ?? 0).getTime();
  return bTime - aTime;
}

function dayStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown-day";
  return d.toISOString().slice(0, 10);
}

export function hydrateAssets(db) {
  const sourceById = new Map(db.sourceFiles.map((sf) => [sf.id, sf]));

  return db.assets.map((asset) => {
    const sourceFiles = asset.sourceFileIds.map((id) => sourceById.get(id)).filter(Boolean);
    return {
      ...asset,
      sourceFiles,
      fileNames: sourceFiles.map((s) => s.originalName),
    };
  });
}

export function queryAssets(db, {
  type,
  search,
  rawOnly = false,
  jpegOnly = false,
  cameraModel,
  page = 1,
  pageSize = 50,
} = {}) {
  let assets = hydrateAssets(db);

  if (type && ["photo", "video"].includes(type)) {
    assets = assets.filter((a) => a.type === type);
  }

  if (cameraModel) {
    const target = cameraModel.toLowerCase();
    assets = assets.filter((a) => (a.cameraModel ?? "").toLowerCase().includes(target));
  }

  if (rawOnly) {
    assets = assets.filter((a) => a.sourceFiles.some((f) => f?.raw));
  }

  if (jpegOnly) {
    assets = assets.filter((a) => a.sourceFiles.some((f) => f?.jpeg));
  }

  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    assets = assets.filter((a) => a.fileNames.some((name) => name.toLowerCase().includes(q)));
  }

  assets.sort((a, b) => sortByDateDesc(a, b, "takenAt"));

  return paginate(assets, page, pageSize);
}

export function timelineByDay(db, {
  groupBy = "day_taken",
  type,
  page = 1,
  pageSize = 30,
} = {}) {
  const field = groupBy === "day_imported" ? "importedAt" : "takenAt";

  let assets = hydrateAssets(db);
  if (type && ["photo", "video"].includes(type)) {
    assets = assets.filter((a) => a.type === type);
  }

  assets.sort((a, b) => sortByDateDesc(a, b, field));

  const grouped = new Map();
  for (const asset of assets) {
    const key = dayStamp(asset[field]);
    const existing = grouped.get(key) ?? [];
    existing.push(asset);
    grouped.set(key, existing);
  }

  const timeline = Array.from(grouped.entries()).map(([day, dayAssets]) => ({
    day,
    count: dayAssets.length,
    assets: dayAssets,
  }));

  return paginate(timeline, page, pageSize);
}
