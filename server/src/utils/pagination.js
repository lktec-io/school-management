export function parsePagination(query = {}, { defaultPageSize = 25, maxPageSize = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requested = Number.parseInt(query.pageSize, 10) || defaultPageSize;
  const pageSize = Math.min(Math.max(1, requested), maxPageSize);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function paginated(items, total, { page, pageSize }) {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
