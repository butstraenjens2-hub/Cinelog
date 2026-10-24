import assert from "node:assert/strict";
import test from "node:test";

import { credentialsFromPlaylistUrl, formatLoadReport, loadPlaylistFallbacks } from "./fallback.mjs";

test("a get.php address yields a server, username, and password", () => {
  const creds = credentialsFromPlaylistUrl(
    "http://example.com/get.php?username=ada&password=p%40ss&type=m3u_plus&output=ts",
  );
  assert.equal(creds.server, "http://example.com");
  assert.equal(creds.username, "ada");
  assert.equal(creds.password, "p@ss");
  const nested = credentialsFromPlaylistUrl("http://example.com:8080/portal/get.php?username=ada&password=secret");
  assert.equal(nested.server, "http://example.com:8080/portal");
  assert.equal(credentialsFromPlaylistUrl("http://example.com/list.m3u"), null);
});

test("OkHttp items stop the fallback chain", async () => {
  let vlc = 0;
  let xtream = 0;
  const loaded = await loadPlaylistFallbacks({
    url: "http://example.com/get.php?username=ada&password=s3cret&type=m3u_plus&output=ts",
    loadOkHttp: async () => ({
      items: [{ id: "1", kind: "live", name: "One" }],
      counts: { live: 1, movie: 0, series: 0 },
      diagnosis: null,
      warnings: [],
    }),
    loadVlc: async () => {
      vlc += 1;
      return { items: [], reason: "" };
    },
    loadXtream: async () => {
      xtream += 1;
      return { items: [], warnings: [] };
    },
  });
  assert.equal(loaded.items.length, 1);
  assert.equal(loaded.via, "OkHttp");
  assert.equal(loaded.report, "");
  assert.equal(vlc, 0);
  assert.equal(xtream, 0);
});

test("zero OkHttp items try libVLC and then the Xtream API", async () => {
  const calls = [];
  const loaded = await loadPlaylistFallbacks({
    url: "http://example.com/get.php?username=ada&password=s3cret&type=m3u_plus&output=ts",
    loadOkHttp: async () => ({
      items: [],
      counts: { live: 0, movie: 0, series: 0 },
      diagnosis: {
        reason: "HTML login page",
        snippet: "HTML login page",
        status: 200,
        contentType: "text/html",
        bytes: 120,
        details: ["HTTP 200", "Content-Type: text/html", "Preview: HTML login page"],
      },
      warnings: [],
    }),
    loadVlc: async () => {
      calls.push("vlc");
      return { items: [], reason: "libVLC parsed 0 items" };
    },
    loadXtream: async (creds) => {
      calls.push(creds.username);
      assert.equal(creds.password, "s3cret");
      return {
        items: [
          { id: "9", kind: "live", name: "News" },
          { id: "10", kind: "movie", name: "Film" },
        ],
        warnings: [],
      };
    },
  });
  assert.deepEqual(calls, ["vlc", "ada"]);
  assert.equal(loaded.via, "Xtream API");
  assert.equal(loaded.counts.live, 1);
  assert.equal(loaded.counts.movie, 1);
  assert.match(loaded.report, /Tried: OkHttp/);
  assert.match(loaded.report, /HTTP 200/);
  assert.match(loaded.report, /text\/html/);
  assert.match(loaded.report, /HTML login page/);
  assert.match(loaded.report, /Tried: libVLC/);
  assert.match(loaded.report, /Tried: Xtream API/);
  assert.equal(loaded.report.includes("s3cret"), false);
  assert.equal(loaded.report.includes("example.com"), false);
  assert.equal(loaded.report.includes("http"), false);
});

test("a cancelled download does not try another loader", async () => {
  let vlc = 0;
  await assert.rejects(
    () =>
      loadPlaylistFallbacks({
        url: "http://example.com/get.php?username=ada&password=s3cret",
        loadOkHttp: async () => {
          throw new Error("Cancelled");
        },
        loadVlc: async () => {
          vlc += 1;
          return null;
        },
        loadXtream: async () => ({ items: [{ id: "1", kind: "live" }], warnings: [] }),
      }),
    /Cancelled/,
  );
  assert.equal(vlc, 0);
});

test("a failed OkHttp response keeps status, content type, and a short preview", async () => {
  const loaded = await loadPlaylistFallbacks({
    url: "http://example.com/list.m3u",
    loadOkHttp: async () => {
      const error = new Error("Playlist: HTTP 403");
      error.exchange = {
        status: 403,
        body: "Sign in password=s3cret at http://example.com/login",
        responseHeaders: { "Content-Type": "text/html; charset=utf-8" },
        requestHeaders: { "User-Agent": "VLC/3.0.21 LibVLC/3.0.21" },
      };
      throw error;
    },
    loadVlc: async () => null,
    loadXtream: async () => {
      throw new Error("should not run");
    },
  });
  assert.match(loaded.report, /HTTP 403/);
  assert.match(loaded.report, /text\/html/);
  assert.match(loaded.report, /Preview:/);
  assert.match(loaded.report, /User-Agent: VLC\/3\.0\.21/);
  assert.equal(loaded.report.includes("s3cret"), false);
  assert.equal(loaded.report.includes("http://"), false);
});

test("a failed download still records status, headers, and the preview", async () => {
  const loaded = await loadPlaylistFallbacks({
    url: "http://example.com/list.m3u",
    loadOkHttp: async () => {
      throw new Error("Playlist: HTTP 403 http://example.com/get.php?username=ada&password=s3cret");
    },
    loadVlc: async () => null,
    loadXtream: async () => {
      throw new Error("should not run");
    },
  });
  assert.equal(loaded.items.length, 0);
  assert.match(loaded.report, /Tried: OkHttp/);
  assert.match(loaded.report, /Tried: libVLC/);
  assert.match(loaded.report, /not available/);
  assert.match(loaded.report, /Tried: Xtream API/);
  assert.match(loaded.report, /no username and password/);
  assert.equal(loaded.report.includes("s3cret"), false);
  assert.equal(loaded.report.includes("http://"), false);
  const direct = formatLoadReport([
    { name: "OkHttp", outcome: "failed", status: 403, contentType: "text/html", snippet: "HTML login page: Sign in", bytes: 40 },
  ]);
  assert.match(direct, /HTTP 403/);
  assert.match(direct, /Content-Type: text\/html/);
  assert.match(direct, /Preview: HTML login page/);
  assert.match(direct, /Bytes: 40/);
});
