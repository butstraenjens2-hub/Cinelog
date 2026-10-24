/**
 * URL helpers for a server the viewer configured, such as Jellyfin or Emby.
 */

export function normalizeServerUrl(input) {
  const trimmed = String(input ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw Object.assign(new Error("Server URL is required."), { status: 0 });
  }
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw Object.assign(
      new Error("Enter a full URL, including http:// or https://."),
      { status: 0 },
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw Object.assign(new Error("Only http and https URLs are supported."), {
      status: 0,
    });
  }
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path && path !== "/" ? path : ""}`;
}

export function joinApi(base, path) {
  const root = normalizeServerUrl(base);
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${root}${suffix}`;
}
