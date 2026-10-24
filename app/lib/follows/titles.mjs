/** Newest and upcoming titles for a followed person, studio, or network. */

function localDay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function titleSortKey(item) {
  const date = String(item?.releaseDate ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const year = Number(item?.year);
  if (year > 0) return `${year}-01-01`;
  return "";
}

export function newestAndUpcoming(items, now = new Date()) {
  const today = localDay(now);
  const dated = (Array.isArray(items) ? items : [])
    .map((item) => ({ item, key: titleSortKey(item) }))
    .filter((row) => row.key)
    .sort(
      (left, right) =>
        right.key.localeCompare(left.key) ||
        String(left.item.title).localeCompare(String(right.item.title)),
    );
  return {
    upcoming: dated
      .filter((row) => row.key >= today)
      .map((row) => row.item)
      .reverse(),
    newest: dated
      .filter((row) => row.key < today)
      .slice(0, 12)
      .map((row) => row.item),
  };
}
