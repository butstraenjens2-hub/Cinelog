export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  const cleaned = String(path ?? "").replace(/^[a-z]+:\/\//, "").replace(/^\/+/, "");
  if (/^(movie|series)\/\d+$/.test(cleaned)) return `/${cleaned}`;
  if (cleaned === "live") return "/(tabs)/live";
  return "/";
}
