/**
 * Playlist HTTP. CineLog does not ship a playlist.
 * Requests are GET and follow redirects. The header set matches VLC:
 * a player User-Agent, Accept star-slash-star, Range bytes=0-, and
 * Icy-MetaData 1. OkHttp 4.9.2 adds Accept-Encoding gzip unless Range
 * or Accept-Encoding is already set, and panels answer that with 403.
 */

export const DEFAULT_IPTV_USER_AGENT = "VLC/3.0.21 LibVLC/3.0.21";

/** Player names a panel may allow. Custom is whatever the viewer types. */
export const IPTV_PRESETS = [
  { id: "vlc", label: "VLC", userAgent: DEFAULT_IPTV_USER_AGENT },
  { id: "smarters", label: "IPTV Smarters", userAgent: "IPTVSmartersPlayer" },
  { id: "tivimate", label: "TiviMate", userAgent: "TiviMate/4.7.0" },
  { id: "okhttp", label: "okhttp", userAgent: "okhttp/4.9.2" },
  { id: "custom", label: "Custom", userAgent: "" },
];

export function effectiveUserAgent(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || DEFAULT_IPTV_USER_AGENT;
}

export function resolveUserAgent(preset, custom) {
  const match = IPTV_PRESETS.find((item) => item.id === preset);
  if (!match || match.id === "custom") return effectiveUserAgent(custom);
  return match.userAgent;
}

/**
 * Headers a playlist request asks for. Referer, Origin, Accept-Language,
 * Cookie, and Accept-Encoding are omitted on purpose.
 */
export function playlistHeaders(userAgent) {
  return {
    "User-Agent": effectiveUserAgent(userAgent),
    Accept: "*/*",
    Range: "bytes=0-",
    "Icy-MetaData": "1",
  };
}

function hasHeader(headers, name) {
  const needle = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === needle);
}

/**
 * What Android's OkHttp 4.9.2 BridgeInterceptor adds before the bytes leave
 * the phone. Range suppresses Accept-Encoding gzip. The cookie jar used by
 * React Native fetch is empty unless credentials are included, which playlist
 * requests do not do. Accept-Language is not added.
 */
export function androidWireHeaders(headers) {
  const wire = { ...headers };
  if (!hasHeader(wire, "Connection")) wire.Connection = "Keep-Alive";
  if (!hasHeader(wire, "Accept-Encoding") && !hasHeader(wire, "Range")) {
    wire["Accept-Encoding"] = "gzip";
  }
  if (!hasHeader(wire, "User-Agent")) wire["User-Agent"] = "okhttp/4.9.2";
  return wire;
}

export function safeHeaderValue(name, value) {
  const label = String(name || "").toLowerCase();
  const text = String(value ?? "");
  if (label === "location" || label === "set-cookie" || label === "cookie") return "(hidden)";
  if (/password=|username=|:\/\//i.test(text)) return "(hidden)";
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

export function formatExchangeReport(exchange) {
  const lines = ["Request headers:"];
  for (const [name, value] of Object.entries(exchange?.requestHeaders || {})) {
    lines.push(`${name}: ${safeHeaderValue(name, value)}`);
  }
  for (const name of ["Accept-Encoding", "Accept-Language", "Cookie", "Referer", "Origin"]) {
    if (!hasHeader(exchange?.requestHeaders || {}, name)) lines.push(`${name}: not sent`);
  }
  if (exchange?.scheme) lines.push(exchange.scheme);
  lines.push(`Response: HTTP ${exchange?.status ?? ""}`.trim());
  const response = Object.entries(exchange?.responseHeaders || {});
  if (response.length) {
    lines.push("Response headers:");
    for (const [name, value] of response) lines.push(`${name}: ${safeHeaderValue(name, value)}`);
  }
  return lines;
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

export function formatStepError(step, status, body) {
  const http = formatHttpError(status, body);
  const name = String(step ?? "").trim();
  return name ? `${name}: ${http}` : http;
}

function clip(value) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, 180);
}

function readHeaders(response) {
  const headers = response?.headers;
  if (!headers) return {};
  if (typeof headers.forEach === "function") {
    const out = {};
    headers.forEach((value, name) => {
      out[String(name)] = String(value);
    });
    return out;
  }
  return { ...headers };
}

function schemeNote(requestUrl, responseUrl) {
  if (!responseUrl) return "";
  try {
    const from = new URL(String(requestUrl)).protocol.replace(":", "");
    const to = new URL(String(responseUrl)).protocol.replace(":", "");
    if (!from || !to) return "";
    return from === to ? `Scheme stayed ${from}.` : `Scheme changed from ${from} to ${to}.`;
  } catch {
    return "";
  }
}

/**
 * GET a playlist or player_api.php response and keep the headers for the
 * connection report. `fetchImpl` is for tests. Nothing in the result includes
 * the request URL, because an Xtream URL contains the password.
 */
export async function exchangePlaylist(url, options = {}) {
  const headers = playlistHeaders(options.userAgent);
  const doFetch = options.fetchImpl || fetch;
  const response = await doFetch(url, {
    method: "GET",
    redirect: "follow",
    headers,
  });
  let body = "";
  try {
    body = await response.text();
  } catch {
    body = "";
  }
  const exchange = {
    ok: Boolean(response.ok),
    status: response.status,
    body,
    requestHeaders: androidWireHeaders(headers),
    responseHeaders: readHeaders(response),
    scheme: schemeNote(url, response.url),
  };
  if (!response.ok) {
    const error = new Error(formatStepError(options.step, response.status, body));
    error.status = response.status;
    error.step = options.step || "";
    error.exchange = exchange;
    throw error;
  }
  return exchange;
}

/** GET a playlist body. The thrown message never includes the request URL. */
export async function fetchPlaylist(url, options = {}) {
  const exchange = await exchangePlaylist(url, options);
  return exchange.body;
}
