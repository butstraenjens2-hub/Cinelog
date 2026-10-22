/**
 * Playlist HTTP. CineLog does not ship a playlist.
 * Requests are GET and follow redirects. The player name is configurable
 * because many panels reject a browser user agent with HTTP 403.
 */

export const DEFAULT_IPTV_USER_AGENT = "VLC/3.0.21 LibVLC/3.0.21";

export function effectiveUserAgent(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || DEFAULT_IPTV_USER_AGENT;
}

export function plainServerMessage(body) {
  const raw = String(body ?? "").replace(/^\uFEFF/, "").trim();
  if (!raw) return "";
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      const message =
        parsed?.message ||
        parsed?.error ||
        parsed?.user_info?.message ||
        "";
      if (message) return clip(String(message));
    } catch {
      /* The body is not JSON. */
    }
  }
  const titled = raw.match(/<title>([^<]{1,180})<\/title>/i);
  if (titled) return clip(titled[1]);
  return clip(raw.replace(/<[^>]+>/g, " "));
}

export function formatHttpError(status, body) {
  const detail = plainServerMessage(body);
  return detail ? `HTTP ${status}: ${detail}` : `HTTP ${status}`;
}

function clip(value) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, 180);
}

/**
 * GET a playlist or player_api.php response.
 * `fetchImpl` is for tests. The thrown message is the status and the server
 * text, never the request URL (Xtream puts the password in the query).
 */
export async function fetchPlaylist(url, options = {}) {
  const userAgent = effectiveUserAgent(options.userAgent);
  const doFetch = options.fetchImpl || fetch;
  const response = await doFetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent": userAgent,
      Accept: "*/*",
    },
  });
  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      body = "";
    }
    const error = new Error(formatHttpError(response.status, body));
    error.status = response.status;
    throw error;
  }
  return response.text();
}
