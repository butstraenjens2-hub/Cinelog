import assert from "node:assert/strict";
import test from "node:test";

import { decodeListShare, encodeListShare } from "./share.mjs";

test("a shared list round-trips through the deep link and keeps TMDB links", () => {
  const shared = encodeListShare({
    name: "Friday",
    items: [
      { type: "movie", tmdbId: 603, title: "The Matrix", year: 1999 },
      { type: "series", tmdbId: 1396, title: "Breaking Bad", year: 2008 },
    ],
  });
  assert.match(shared.message, /themoviedb\.org\/movie\/603/);
  assert.match(shared.message, /themoviedb\.org\/tv\/1396/);
  const decoded = decodeListShare(shared.message);
  assert.equal(decoded.name, "Friday");
  assert.deepEqual(
    decoded.items.map((item) => `${item.type}:${item.tmdbId}`),
    ["movie:603", "series:1396"],
  );
});

test("TMDB links without a deep link still import", () => {
  const decoded = decodeListShare(
    "Watch these\nhttps://www.themoviedb.org/movie/550\nhttps://www.themoviedb.org/tv/1399",
  );
  assert.equal(decoded.items.length, 2);
  assert.equal(decoded.items[0].id, "movie:550");
  assert.equal(decoded.items[1].type, "series");
});
