/** Keep the complete ranking in the service, but bound the rendered portraits. */
export function paginateUciRiders<T>(entries: readonly T[], requestedPage: number) {
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const page = Math.min(pageCount, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
  return {
    entries: entries.slice((page - 1) * pageSize, page * pageSize),
    page, pageCount, totalEntries: entries.length,
    view: "individuel" as const,
  };
}
