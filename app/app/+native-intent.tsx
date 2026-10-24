export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  const cleaned = String(path ?? "").replace(/^[a-z]+:\/\//, "").replace(/^\/+/, "");
  if (/^(movie|series)\/\d+$/.test(cleaned)) return `/${cleaned}`;
  const sharedList = /^list\/([A-Za-z0-9_-]+)/.exec(cleaned);
  if (sharedList) return `/lists/import?payload=${sharedList[1]}`;
  if (cleaned === "live") return "/(tabs)/live";
  return "/";
}
