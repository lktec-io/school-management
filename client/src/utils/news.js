/** Announcements published within this many days are marked as new. */
export const NEWS_FRESH_DAYS = 14;

export function isFreshNews(publishedAt, now = new Date()) {
  if (!publishedAt) return false;
  const published = new Date(`${String(publishedAt).slice(0, 10)}T12:00:00`);
  return now - published <= NEWS_FRESH_DAYS * 24 * 60 * 60 * 1000;
}
