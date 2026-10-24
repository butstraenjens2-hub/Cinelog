/**
 * Share text for a named list. The deep link carries titles so another
 * CineLog can import offline. TMDB links are included for people who
 * open the text in a browser.
 */

const DEEP_LINK = /cinelog:\/\/list\/([A-Za-z0-9_-]+)/g;
const TMDB_LINK = /themoviedb\.org\/(movie|tv)\/(\d+)/g;

function base64urlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded =
    typeof globalThis.btoa === "function"
      ? globalThis.btoa(binary)
      : Buffer.from(text, "utf8").toString("base64");
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlDecode(value) {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(b64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(b64, "base64").toString("utf8");
}

export function tmdbTitleUrl(type, tmdbId) {
  const kind = type === "series" ? "tv" : "movie";
  return `https://www.themoviedb.org/${kind}/${tmdbId}`;
}

function asItem(raw) {
  const tmdbId = Number(raw?.tmdbId);
  const type = raw?.type === "series" ? "series" : "movie";
  const title = String(raw?.title ?? "").trim();
  if (!tmdbId || tmdbId < 1 || !title) return null;
  return {
    id: `${type}:${tmdbId}`,
    tmdbId,
    type,
    title: title.slice(0, 120),
    poster: null,
    backdrop: null,
    year: Number(raw?.year) || 0,
    rating: 0,
    genres: [],
    genreIds: [],
    releaseDate: null,
  };
}

export function encodeListShare(list) {
  const name = String(list?.name || "List").trim().slice(0, 80) || "List";
  const items = (Array.isArray(list?.items) ? list.items : [])
    .slice(0, 100)
    .map(asItem)
    .filter(Boolean);
  const token = base64urlEncode(JSON.stringify({ v: 1, name, items }));
  const url = `cinelog://list/${token}`;
  const links = items.map((item) => tmdbTitleUrl(item.type, item.tmdbId)).join("\n");
  return {
    url,
    message: `CineLog list: ${name}\n${url}${links ? `\n${links}` : ""}`,
  };
}

function fromToken(token) {
  try {
    const parsed = JSON.parse(base64urlDecode(token));
    const items = (Array.isArray(parsed.items) ? parsed.items : [])
      .map(asItem)
      .filter(Boolean);
    if (!items.length) return null;
    const name = String(parsed.name || "Shared list").trim().slice(0, 80) || "Shared list";
    return { name, items };
  } catch {
    return null;
  }
}

export function decodeListShare(text) {
  const raw = String(text ?? "");
  for (const match of raw.matchAll(DEEP_LINK)) {
    const decoded = fromToken(match[1]);
    if (decoded) return decoded;
  }
  const items = [];
  const seen = new Set();
  for (const match of raw.matchAll(TMDB_LINK)) {
    const type = match[1] === "tv" ? "series" : "movie";
    const tmdbId = Number(match[2]);
    const id = `${type}:${tmdbId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const item = asItem({
      type,
      tmdbId,
      title: type === "movie" ? `Movie ${tmdbId}` : `Series ${tmdbId}`,
    });
    if (item) items.push(item);
  }
  if (!items.length) return null;
  const named = raw.match(/CineLog list:\s*(.+)/);
  const name = named ? named[1].trim().slice(0, 80) : "Shared list";
  return { name: name || "Shared list", items };
}
