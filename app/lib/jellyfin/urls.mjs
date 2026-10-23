/**
 * URL pieces for a viewer's own Jellyfin or Emby server.
 * The access token is a header, never part of these paths.
 */

export function mediaBrowserAuthHeader(version = "1.0.42") {
  return `MediaBrowser Client="CineLog", Device="CineLog", DeviceId="cinelog", Version="${version}"`;
}

export function directStreamPath(itemId, mediaSourceId) {
  const id = encodeURIComponent(String(itemId ?? ""));
  const params = ["static=true"];
  if (mediaSourceId) params.push(`MediaSourceId=${encodeURIComponent(String(mediaSourceId))}`);
  return `/Videos/${id}/stream?${params.join("&")}`;
}
