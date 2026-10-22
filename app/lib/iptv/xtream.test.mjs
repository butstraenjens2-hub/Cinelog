import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCatchupStart,
  mapXtreamCategories,
  mapXtreamStreams,
  xtreamApiUrl,
  xtreamCatchupUrl,
  xtreamLiveUrl,
} from "./xtream.mjs";

test("xtream urls stay on the viewer's server and encode the password", () => {
  const live = xtreamLiveUrl("http://example.com:8080/", "ada", "p@ss", 15);
  assert.equal(live, "http://example.com:8080/live/ada/p%40ss/15.m3u8");
  const api = new URL(xtreamApiUrl("https://example.com", "ada", "secret", "get_live_streams"));
  assert.equal(api.origin, "https://example.com");
  assert.equal(api.searchParams.get("action"), "get_live_streams");
  assert.equal(api.searchParams.get("username"), "ada");
  const catchup = xtreamCatchupUrl("https://example.com", "ada", "secret", 4, "2026-10-22:09-00", 60);
  assert.match(catchup, /\/timeshift\/ada\/secret\/60\/2026-10-22%3A09-00\/4\.m3u8$/);
  assert.equal(formatCatchupStart(Date.UTC(2026, 9, 22, 9, 5)), "2026-10-22:09-05");
});

test("xtream catalogue maps categories and catch-up only when the server offers it", () => {
  assert.deepEqual(mapXtreamCategories([{ category_id: "3", category_name: "News" }]), [
    { id: "3", name: "News" },
  ]);
  const rows = mapXtreamStreams(
    [{ stream_id: 9, name: "One", category_id: 3, epg_channel_id: "one", tv_archive: 1, tv_archive_duration: 4 }],
    "live",
  );
  assert.equal(rows[0].archiveHours, 4);
  assert.equal(rows[0].tvgId, "one");
  const plain = mapXtreamStreams([{ stream_id: 2, name: "Film", tv_archive: 0 }], "movie");
  assert.equal(plain[0].archiveHours, 0);
});
