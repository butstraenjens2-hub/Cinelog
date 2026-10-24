/**
 * Small XMLTV reader for the guide subset CineLog displays.
 *
 * XMLTV is a documented interchange format (programme start/stop, channel,
 * title, desc). This parser is original and only understands that subset.
 */

const PROGRAMME_RE = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
const CHANNEL_RE = /<channel\b([^>]*)>([\s\S]*?)<\/channel>/gi;
const ATTR_RE = /([\w:-]+)="([^"]*)"/g;
const TAG_RE = /<(title|desc)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/i;

function decode(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function attrs(source) {
  const out = {};
  const re = new RegExp(ATTR_RE.source, "g");
  let match = re.exec(source);
  while (match) {
    out[match[1]] = decode(match[2]);
    match = re.exec(source);
  }
  return out;
}

function childText(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = re.exec(block);
  return match ? decode(match[1]) : "";
}

/** XMLTV timestamps look like `20261022180000 +0000`. Returns epoch ms. */
export function parseXmltvTimestamp(value) {
  const match =
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-])(\d{2})(\d{2})?$/.exec(
      String(value ?? "").trim(),
    );
  if (!match) return null;
  const utc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  );
  const offset =
    (Number(match[8]) * 60 + Number(match[9] || 0)) * 60 * 1000;
  return match[7] === "+" ? utc - offset : utc + offset;
}

export function formatXmltvTimestamp(epochMs) {
  const date = new Date(epochMs);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())} +0000`
  );
}

export function parseXmltv(xml) {
  const source = String(xml ?? "");
  const channels = [];
  const programmes = [];

  for (const match of source.matchAll(CHANNEL_RE)) {
    const attributes = attrs(match[1]);
    if (!attributes.id) continue;
    channels.push({
      id: attributes.id,
      name: childText(match[2], "display-name") || attributes.id,
    });
  }

  for (const match of source.matchAll(PROGRAMME_RE)) {
    const attributes = attrs(match[1]);
    const startMs = parseXmltvTimestamp(attributes.start);
    const stopMs = parseXmltvTimestamp(attributes.stop);
    if (!attributes.channel || startMs == null || stopMs == null) continue;
    const titleMatch = TAG_RE.exec(match[2]);
    programmes.push({
      channelId: attributes.channel,
      startMs,
      stopMs,
      title: childText(match[2], "title") || (titleMatch ? decode(titleMatch[2]) : ""),
      summary: childText(match[2], "desc"),
    });
  }

  programmes.sort((left, right) => left.startMs - right.startMs);
  return { channels, programmes };
}

/** Programmes that overlap [startMs, endMs). */
export function programmesBetween(programmes, startMs, endMs) {
  return programmes.filter(
    (programme) => programme.stopMs > startMs && programme.startMs < endMs,
  );
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build a one-day guide from factual channel descriptions. This is not a
 * scraped listings feed; each block describes the broadcaster's own service.
 */
export function buildGuideXml(channels, now = Date.now()) {
  const start = now - (now % (60 * 60 * 1000));
  const blocks = 8;
  const span = 3 * 60 * 60 * 1000;
  const channelXml = channels
    .map(
      (channel) =>
        `  <channel id="${escapeXml(channel.id)}"><display-name>${escapeXml(channel.name)}</display-name></channel>`,
    )
    .join("\n");
  const programmes = [];
  for (const channel of channels) {
    for (let index = 0; index < blocks; index += 1) {
      const startMs = start + index * span;
      programmes.push(
        `  <programme start="${formatXmltvTimestamp(startMs)}" stop="${formatXmltvTimestamp(startMs + span)}" channel="${escapeXml(channel.id)}">` +
          `<title>${escapeXml(channel.name)}</title>` +
          `<desc>${escapeXml(channel.summary)}</desc>` +
          `</programme>`,
      );
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n${channelXml}\n${programmes.join("\n")}\n</tv>\n`;
}
