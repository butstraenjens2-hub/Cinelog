import assert from "node:assert/strict";
import test from "node:test";

import { joinApi, movieAddBody, normalizeServerUrl, seriesAddBody } from "./url.mjs";

test("normalizes a server origin and keeps a reverse-proxy path", () => {
  assert.equal(normalizeServerUrl("http://192.168.1.20:8989/"), "http://192.168.1.20:8989");
  assert.equal(
    normalizeServerUrl("https://media.example/sonarr/"),
    "https://media.example/sonarr",
  );
  assert.throws(() => normalizeServerUrl("ftp://example.com"), /http/);
  assert.throws(() => normalizeServerUrl("not a url"), /full URL/);
});

test("joins the public v3 path without duplicating slashes", () => {
  assert.equal(
    joinApi("http://nas:8989/", "/api/v3/system/status"),
    "http://nas:8989/api/v3/system/status",
  );
});

test("add bodies do not search indexers unless the viewer opts in", () => {
  const series = seriesAddBody(
    { title: "Example", tvdbId: 1, id: 0, tmdbId: 10 },
    { qualityProfileId: 4, rootFolderPath: "/tv" },
  );
  assert.equal(series.id, undefined);
  assert.equal(series.qualityProfileId, 4);
  assert.equal(series.addOptions.searchForMissingEpisodes, false);
  assert.equal(series.addOptions.monitor, "all");

  const movie = movieAddBody(
    { title: "Example", tmdbId: 5, id: 0 },
    { qualityProfileId: 2, rootFolderPath: "/movies", searchForMovie: true },
  );
  assert.equal(movie.addOptions.searchForMovie, true);
  assert.equal(movie.id, undefined);
});
