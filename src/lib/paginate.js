export function normalizePage(input, fallback = 1) {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function normalizePageSize(input, fallback = 50, max = 200) {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

export function paginate(items, page = 1, pageSize = 50) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const offset = (safePage - 1) * pageSize;

  return {
    items: items.slice(offset, offset + pageSize),
    pagination: {
      total,
      page: safePage,
      pageSize,
      pages,
    },
  };
}
