/**
 * M3U parser for a playlist the viewer supplied.
 * CineLog does not ship a playlist of its own.
 */

const ATTR_RE = /([\w-]+)="([^"]*)"/g;

export function kindFor(url, group) {
  const blob = `${url} ${group}`.toLowerCase();
  if (/\/series\/|\/serie\/|\bseries\b/.test(blob)) return "series";
  if (/\/movie\/|\/vod\/|\bmovies?\b|\bvod\b/.test(blob)) return "movie";
  return "live";
}

function takeExtinf(line) {
  const attrs = {};
  const re = new RegExp(ATTR_RE.source, "g");
  let match = re.exec(line);
  while (match) {
    attrs[match[1]] = match[2];
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

/** Line-at-a-time parser. Chunks may split a line; the raw file is not kept. */
export function createM3uParser() {
  let pending = null;
  let carry = "";
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
      const text = carry + String(chunk ?? "");
      const lines = text.split(/\r?\n/);
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
