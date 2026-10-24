import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGuideXml,
  parseXmltv,
  parseXmltvTimestamp,
  programmesBetween,
} from "./xmltv.mjs";

test("parses XMLTV timestamps with a numeric offset", () => {
  assert.equal(
    parseXmltvTimestamp("20261022120000 +0000"),
    Date.UTC(2026, 9, 22, 12, 0, 0),
  );
  assert.equal(
    parseXmltvTimestamp("20261022140000 +0200"),
    Date.UTC(2026, 9, 22, 12, 0, 0),
  );
  assert.equal(parseXmltvTimestamp("not-a-time"), null);
});

test("reads channels and programmes and keeps those in a window", () => {
  const xml = `<?xml version="1.0"?>
<tv>
  <channel id="nasa"><display-name>NASA &amp; TV</display-name></channel>
  <programme start="20261022120000 +0000" stop="20261022150000 +0000" channel="nasa">
    <title>Live coverage</title>
    <desc>Public service stream</desc>
  </programme>
  <programme start="20261022080000 +0000" stop="20261022110000 +0000" channel="nasa">
    <title>Earlier</title>
  </programme>
</tv>`;
  const guide = parseXmltv(xml);
  assert.equal(guide.channels[0].name, "NASA & TV");
  assert.equal(guide.programmes.length, 2);
  const windowStart = Date.UTC(2026, 9, 22, 12, 0, 0);
  const visible = programmesBetween(
    guide.programmes,
    windowStart,
    windowStart + 60 * 60 * 1000,
  );
  assert.equal(visible.length, 1);
  assert.equal(visible[0].title, "Live coverage");
});

test("round-trips a generated guide", () => {
  const now = Date.UTC(2026, 9, 22, 12, 30, 0);
  const xml = buildGuideXml(
    [{ id: "nasa-public", name: "NASA TV Public", summary: "Public domain." }],
    now,
  );
  const guide = parseXmltv(xml);
  assert.equal(guide.channels.length, 1);
  assert.equal(guide.programmes.length, 8);
  assert.ok(guide.programmes.every((item) => item.channelId === "nasa-public"));
  assert.ok(guide.programmes[0].summary.includes("Public domain"));
});
