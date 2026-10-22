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

export function parseM3u(text) {
  const items = [];
  let pending = null;
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      const attrs = {};
      const re = new RegExp(ATTR_RE.source, "g");
      let match = re.exec(line);
      while (match) {
        attrs[match[1]] = match[2];
        match = re.exec(line);
      }
      const comma = line.lastIndexOf(",");
      const name = (comma >= 0 ? line.slice(comma + 1) : "").trim();
      pending = {
        name: name || attrs["tvg-name"] || "Channel",
        group: attrs["group-title"] || "",
        tvgId: attrs["tvg-id"] || "",
        logo: attrs["tvg-logo"] || "",
      };
      continue;
    }
    if (line.startsWith("#")) continue;
    if (!/^https?:\/\//i.test(line)) continue;
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
  return items;
}
