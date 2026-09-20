/** Every list in the app pages by this many rows; fewer and no pager shows. */
export const PAGE_SIZE = 5

/** The rows of `items` on `page` (1-based), clamped to the last page. */
export function pageOf<T>(items: T[], page: number, pageSize = PAGE_SIZE): T[] {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(Math.max(1, page), pageCount)
  return items.slice((current - 1) * pageSize, current * pageSize)
}
