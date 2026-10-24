/**
 * Builds an iCalendar document for upcoming episodes the viewer already follows.
 * All-day events, so the file does not invent a broadcast time.
 */

function escapeIcs(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function stamp(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function dayStamp(start) {
  const day = String(start ?? "").slice(0, 10).replace(/-/g, "");
  return /^\d{8}$/.test(day) ? day : "";
}

export function buildIcs(events, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CineLog//Upcoming//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  const created = stamp(now);
  for (const event of events ?? []) {
    const day = dayStamp(event.start);
    const uid = String(event.uid ?? "").trim();
    const title = String(event.title ?? "").trim();
    if (!day || !uid || !title) continue;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcs(uid)}@cinelog.app`);
    lines.push(`DTSTAMP:${created}`);
    lines.push(`DTSTART;VALUE=DATE:${day}`);
    lines.push(`SUMMARY:${escapeIcs(title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
