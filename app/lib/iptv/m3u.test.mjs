import assert from "node:assert/strict";
import test from "node:test";
import zlib from "node:zlib";

import { currentAndNext } from "./guide.mjs";
import {
  classifyPlaylist,
  createM3uParser,
  emptyPlaylistSummary,
  formatDownloadSize,
  kindFor,
  parseM3u,
  sectionCounts,
} from "./m3u.mjs";

test("parseM3u splits live, movies and series and keeps the group", () => {
  const items = parseM3u(`#EXTM3U
#EXTINF:-1 tvg-id="news" tvg-logo="https://example.com/a.png" group-title="News",Channel One
https://example.com/live/one.m3u8
#EXTINF:-1 group-title="Films",Example Movie
https://example.com/movie/12.mp4
#EXTINF:-1 group-title="Series",Example Show
https://example.com/series/9.mp4
# comment
not a url
`);
  assert.equal(items.length, 3);
  assert.equal(items[0].kind, "live");
  assert.equal(items[0].group, "News");
  assert.equal(items[0].tvgId, "news");
  assert.equal(items[1].kind, "movie");
  assert.equal(items[2].kind, "series");
  assert.equal(kindFor("https://example.com/live/a.m3u8", "News"), "live");
});

test("m3u_plus attributes, a BOM, and CR LF endings stay one channel", () => {
  const text = `\uFEFF#EXTM3U\r\n#EXTINF:-1 tvg-id="news" tvg-name="Channel One" tvg-logo="https://example.com/a.png" group-title="News",\r\nhttp://example.com/live/1.ts\r\n`;
  const report = classifyPlaylist(text, { status: 200, contentType: "audio/mpegurl", bytes: text.length });
  assert.equal(report.items.length, 1);
  assert.equal(report.items[0].name, "Channel One");
  assert.equal(report.items[0].group, "News");
  assert.equal(report.items[0].tvgId, "news");
  assert.equal(report.items[0].logo, "https://example.com/a.png");
  assert.equal(report.items[0].kind, "live");
  assert.equal(report.reason, "");
});

test("lone CR line endings and single-quoted attributes parse", () => {
  const text = "#EXTM3U\r#EXTINF:-1 tvg-id='drama' group-title='Films',Night\rhttp://example.com/movie/9.mp4\r";
  const items = parseM3u(text);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "movie");
  assert.equal(items[0].group, "Films");
  assert.equal(items[0].tvgId, "drama");
});

test("a movies-only playlist leaves Live at zero", () => {
  const report = classifyPlaylist(`#EXTM3U
#EXTINF:-1 group-title="Films",A
http://example.com/movie/1.mp4
#EXTINF:-1 group-title="Films",B
http://example.com/vod/2.mp4
#EXTINF:-1 group-title="Shows",C
http://example.com/series/3.mp4
`);
  assert.equal(report.counts.live, 0);
  assert.equal(report.counts.movie, 2);
  assert.equal(report.counts.series, 1);
  assert.equal(report.reason, "");
});

test("chunked parsing of a large playlist keeps live, movie, and series counts", () => {
  let body = "#EXTM3U\n";
  for (let index = 0; index < 2000; index += 1) {
    const path = index % 3 === 0 ? "live" : index % 3 === 1 ? "movie" : "series";
    body += `#EXTINF:-1 tvg-id="id${index}" tvg-logo="https://example.com/l.png" group-title="G${index % 5}",Channel ${index}\n`;
    body += `http://example.com/${path}/${index}.ts\n`;
  }
  const parser = createM3uParser();
  for (let index = 0; index < body.length; index += 17) parser.push(body.slice(index, index + 17));
  const items = parser.finish();
  const counts = sectionCounts(items);
  assert.equal(items.length, 2000);
  assert.equal(counts.live, 667);
  assert.equal(counts.movie, 667);
  assert.equal(counts.series, 666);
  assert.equal(items[1].kind, "movie");
  assert.equal(items[2].kind, "series");
});

test("empty, HTML, missing header, and gzip bodies explain a zero-item playlist", () => {
  const empty = classifyPlaylist("", { status: 200, contentType: "text/plain", bytes: 0 });
  assert.equal(empty.reason, "empty body");
  assert.equal(empty.items.length, 0);

  const html = "<html><head><title>Sign in</title></head><body>password=secret https://example.com/login</body></html>";
  const page = classifyPlaylist(html, { status: 200, contentType: "text/html; charset=utf-8", bytes: html.length });
  assert.equal(page.reason, "HTML login page");
  assert.equal(page.snippet.includes("password"), false);
  assert.equal(page.snippet.includes("example.com"), false);
  assert.match(emptyPlaylistSummary(page), /HTTP 200/);
  assert.match(emptyPlaylistSummary(page), /text\/html/);
  assert.equal(emptyPlaylistSummary(page).includes("example.com"), false);
  assert.equal(emptyPlaylistSummary(page).includes("password"), false);

  const headerOnly = classifyPlaylist("#EXTM3U\n#EXTINF:-1,No url follows\n", { status: 200, bytes: 32 });
  assert.equal(headerOnly.reason, "no channel lines");
  assert.equal(classifyPlaylist("hello from the panel").reason, "not #EXTM3U");

  const playlist = "#EXTM3U\n#EXTINF:-1 group-title=\"News\",One\nhttp://example.com/live/1.ts\n";
  const gzip = zlib.gzipSync(Buffer.from(playlist));
  const asText = gzip.toString("latin1");
  const packed = classifyPlaylist(asText, { status: 200, contentType: "application/octet-stream", bytes: gzip.length });
  assert.equal(packed.reason, "gzip binary");
  assert.equal(packed.items.length, 0);
  assert.equal(packed.snippet, "gzip binary");
  const inflated = classifyPlaylist(zlib.gunzipSync(gzip).toString("utf8"));
  assert.equal(inflated.items.length, 1);
  assert.equal(inflated.counts.live, 1);
  assert.equal(formatDownloadSize(gzip.length).endsWith("B") || formatDownloadSize(gzip.length).endsWith("KB"), true);
});

test("EPG timeshift moves the current programme", () => {
  const programmes = [
    { channelId: "news", startMs: 0, stopMs: 60 * 60 * 1000, title: "Hour" },
    { channelId: "news", startMs: 60 * 60 * 1000, stopMs: 2 * 60 * 60 * 1000, title: "Next" },
  ];
  const shifted = currentAndNext(programmes, "news", 30 * 60 * 1000, -1);
  assert.equal(shifted.current.title, "Next");
  const plain = currentAndNext(programmes, "news", 30 * 60 * 1000, 0);
  assert.equal(plain.current.title, "Hour");
  assert.equal(plain.next.title, "Next");
});
