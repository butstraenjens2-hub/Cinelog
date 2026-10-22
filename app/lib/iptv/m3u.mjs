/**
 * M3U parser for a playlist the viewer supplied.
 * CineLog does not ship a playlist of its own.
 *
 * The parser accepts m3u_plus attributes, a leading BOM, and CR, LF, or CRLF
 * line endings. A gzip body is reported instead of being parsed as text:
 * compressed bytes can hide every channel and still look like a successful
 * empty playlist.
 */

const ATTR_RE = /([\w-]+)=(?:"([^"]*)"|'([^']*)')/g;

export function kindFor(url, group) {
  const blob = `${url} ${group}`.toLowerCase();
  if (/\/series\/|\/serie\/|\bseries\b/.test(blob)) return "series";
  if (/\/movie\/|\/vod\/|\bmovies?\b|\bvod\b/.test(blob)) return "movie";
  return "live";
}

export function sectionCounts(items) {
  const counts = { live: 0, movie: 0, series: 0 };
  for (const item of items || []) {
    if (item?.kind === "movie") counts.movie += 1;
    else if (item?.kind === "series") counts.series += 1;
    else counts.live += 1;
  }
  return counts;
}

function takeExtinf(line) {
  const attrs = {};
  const re = new RegExp(ATTR_RE.source, "g");
  let match = re.exec(line);
  while (match) {
    const key = match[1];
    attrs[key] = match[2] !== undefined ? match[2] : match[3] || "";
    match = re.exec(line);
  }
  const comma = line.lastIndexOf(",");
  const name = (comma >= 0 ? line.slice(comma + 1) : "").trim();
  return {
    name: name || attrs["tvg-name"] || "Channel",
    group: attrs["group-title"] || "",
    tvgId: attrs["tvg-id"] || "",
    logo: attrs["tvg-logo"] || "",
  };
}

function stripBom(text) {
  return String(text).replace(/^\uFEFF/, "").replace(/^\u00EF\u00BB\u00BF/, "");
}

/** Line-at-a-time parser. Chunks may split a line; the raw file is not kept. */
export function createM3uParser() {
  let pending = null;
  let carry = "";
  let started = false;
  const items = [];

  function consume(raw) {
    const line = String(raw).trim();
    if (!line) return;
    if (line.startsWith("#EXTINF")) {
      pending = takeExtinf(line);
      return;
    }
    if (line.startsWith("#")) return;
    if (!/^https?:\/\//i.test(line)) return;
    const meta = pending ?? { name: "Channel", group: "", tvgId: "", logo: "" };
    pending = null;
    items.push({
      id: String(items.length + 1),
      name: meta.name,
      group: meta.group,
      tvgId: meta.tvgId,
      logo: meta.logo,
      url: line,
      kind: kindFor(line, meta.group),
    });
  }

  return {
    items,
    push(chunk) {
      let text = carry + String(chunk ?? "");
      if (!started) {
        text = stripBom(text);
        started = true;
      }
      const lines = text.split(/\r\n|\n|\r/);
      carry = lines.pop() ?? "";
      for (const line of lines) consume(line);
    },
    finish() {
      if (carry) consume(carry);
      carry = "";
      return items;
    },
  };
}

export function parseM3u(text) {
  const parser = createM3uParser();
  parser.push(text);
  return parser.finish();
}

export function isGzipPayload(text) {
  const value = String(text ?? "");
  return value.charCodeAt(0) === 0x1f && value.charCodeAt(1) === 0x8b;
}

function binaryKind(text) {
  if (isGzipPayload(text)) return "gzip binary";
  const sample = String(text).slice(0, 64);
  let odd = 0;
  for (let index = 0; index < sample.length; index += 1) {
    const code = sample.charCodeAt(index);
    if (code === 0xfffd || code === 0 || (code < 32 && code !== 9 && code !== 10 && code !== 13)) odd += 1;
  }
  return odd > 0 ? "binary" : "";
}

/** A short preview that never includes a URL or a password. */
export function sanitizeSnippet(text) {
  const raw = String(text ?? "");
  if (!raw) return "";
  const kind = binaryKind(raw);
  if (kind) return kind;
  const head = raw.slice(0, 500);
  if (/<!doctype html|<html[\s>]/i.test(head)) {
    const titled = head.match(/<title>([^<]{1,80})<\/title>/i);
    const title = titled ? titled[1].replace(/\s+/g, " ").trim() : "";
    if (title && !/https?:\/\//i.test(title) && !/password=/i.test(title)) {
      return `HTML login page: ${title}`.slice(0, 80);
    }
    return "HTML login page";
  }
  return head
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/password=[^\s&]*/gi, "password=(hidden)")
    .replace(/username=[^\s&]*/gi, "username=(hidden)")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * Parse a playlist body and, when it yields nothing, say why.
 * `meta.status`, `meta.contentType`, and `meta.bytes` are copied through
 * so the screen can show them without reading the request URL.
 */
export function classifyPlaylist(text, meta = {}) {
  const source = String(text ?? "");
  const status = Number(meta.status || 0);
  const contentType = String(meta.contentType || "");
  const bytes = Number.isFinite(meta.bytes) ? Number(meta.bytes) : source.length;
  const base = { status, contentType, bytes };
  if (!source.trim() || bytes === 0) {
    return { items: [], counts: { live: 0, movie: 0, series: 0 }, reason: "empty body", snippet: "", ...base, bytes: bytes === 0 ? 0 : bytes };
  }
  const kind = binaryKind(source);
  if (kind) {
    return { items: [], counts: { live: 0, movie: 0, series: 0 }, reason: kind, snippet: kind, ...base };
  }
  const items = parseM3u(source);
  const counts = sectionCounts(items);
  const snippet = sanitizeSnippet(source.slice(0, 512));
  if (items.length) return { items, counts, reason: "", snippet, ...base };
  const head = stripBom(source).trimStart();
  let reason = "not #EXTM3U";
  if (/<!doctype html|<html[\s>]/i.test(head.slice(0, 400))) reason = "HTML login page";
  else if (/^#EXTM3U/i.test(head)) reason = "no channel lines";
  return { items, counts, reason, snippet, ...base };
}

export function emptyPlaylistSummary(report) {
  const parts = ["The playlist has no entries."];
  if (report?.status) parts.push(`HTTP ${report.status}.`);
  const type = String(report?.contentType || "").split(";")[0].trim();
  if (type) parts.push(`${type}.`);
  if (report?.reason) parts.push(`${report.reason}.`);
  const snippet = String(report?.snippet || "");
  if (snippet && snippet !== report?.reason && !String(report?.reason || "").includes(snippet)) parts.push(snippet);
  return parts.join(" ");
}

export function formatDownloadSize(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  const mb = n / (1024 * 1024);
  if (mb >= 0.1) return `${mb.toFixed(1)} MB`;
  const kb = n / 1024;
  if (kb >= 1) return `${Math.round(kb)} KB`;
  return `${Math.round(n)} B`;
}

export function playlistDiagnosis(report, extraLines = []) {
  if (report?.items?.length) return null;
  const contentType = String(report?.contentType || "").split(";")[0].trim();
  const details = [
    report?.status ? `HTTP ${report.status}` : "",
    contentType ? `Content-Type: ${contentType}` : "",
    Number.isFinite(report?.bytes) ? `Bytes: ${report.bytes}` : "",
    report?.reason ? `Cause: ${report.reason}` : "",
    report?.snippet ? `Preview: ${report.snippet}` : "",
    ...extraLines,
  ].filter(Boolean);
  return {
    reason: report?.reason || "not #EXTM3U",
    snippet: report?.snippet || "",
    status: Number(report?.status || 0),
    contentType,
    bytes: Number(report?.bytes || 0),
    details,
  };
}
