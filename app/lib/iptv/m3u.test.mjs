import assert from "node:assert/strict";
import test from "node:test";

import { kindFor, parseM3u } from "./m3u.mjs";

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
