/** Group an air date into today or the following six days. */

function localDay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  return localDay(new Date(year, month - 1, day + days));
}

export function scheduleBucket(airDate, now = new Date()) {
  const day = String(airDate ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const start = localDay(now);
  if (day === start) return "today";
  const end = addDays(start, 7);
  if (day > start && day < end) return "week";
  return null;
}
