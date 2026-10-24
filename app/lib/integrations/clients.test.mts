import assert from "node:assert/strict";
import test from "node:test";

import { buildIcs } from "@/lib/calendar/ics.mjs";
import { jellyfinReportProgress, jellyfinResume, jellyfinStreamUrl } from "@/lib/jellyfin/api";
import { addMovieToRadarr, radarrMovieState, testRadarr } from "@/lib/radarr/api";

const originalFetch = globalThis.fetch;

function header(init: RequestInit, name: string): string {
  const headers = init.headers;
  if (!headers || headers instanceof Headers || Array.isArray(headers)) return "";
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return String(value);
  }
  return "";
}

function installFetch(
  handler: (url: string, init: RequestInit) => { status?: number; body?: unknown },
) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const request = init ?? {};
    calls.push({ url, init: request });
    const result = handler(url, request);
    const status = result.status ?? 200;
    const text = JSON.stringify(result.body ?? {});
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => result.body ?? {},
      text: async () => (status === 204 ? "" : text),
    } as Response;
  }) as typeof fetch;
  return calls;
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("Jellyfin resume positions and progress stay on the server", async () => {
  const calls = installFetch((url) => {
    if (url.includes("/Items/Resume")) {
      return {
        body: {
          Items: [
            {
              Id: "item-1",
              Name: "Film",
              Type: "Movie",
              ProductionYear: 1999,
              MediaSources: [{ Id: "src 2" }],
              UserData: { PlaybackPositionTicks: 150_000_000 },
            },
          ],
        },
      };
    }
    return { body: {} };
  });

  const rows = await jellyfinResume("http://jellyfin.local:8096", "jelly-token", "user-1");
  assert.equal(rows[0]?.positionSeconds, 15);
  assert.equal(rows[0]?.mediaSourceId, "src 2");
  await jellyfinReportProgress("http://jellyfin.local:8096", "jelly-token", "item-1", 20, false);
  const stream = jellyfinStreamUrl("http://jellyfin.local:8096", rows[0]);
  assert.equal(stream.includes("jelly-token"), false);
  assert.match(stream, /MediaSourceId=src%202/);
  for (const call of calls) {
    assert.equal(call.url.includes("jelly-token"), false);
    assert.match(header(call.init, "X-Emby-Authorization"), /Version="1\.0\.46"/);
    assert.equal(header(call.init, "X-Emby-Token"), "jelly-token");
  }
  const progress = calls.find((call) => call.url.includes("/Sessions/Playing/Progress"));
  assert.ok(progress);
  const body = JSON.parse(String(progress.init.body));
  assert.equal(body.PositionTicks, 200_000_000);
  assert.equal(body.ItemId, "item-1");
  assert.equal(body.EventName, "TimeUpdate");
});

test("Radarr status, library match, and add keep the API key in the header", async () => {
  const calls = installFetch((url) => {
    if (url.includes("/system/status")) {
      return { body: { appName: "Radarr", version: "5.0.0", instanceName: "Home" } };
    }
    if (url.includes("/movie/lookup")) return { body: [{ title: "Film", tmdbId: 550, id: 0 }] };
    if (url.includes("/movie?")) {
      return {
        body: [
          { id: 3, title: "Other", tmdbId: 11, hasFile: false },
          { id: 9, title: "Film", tmdbId: 550, hasFile: true },
        ],
      };
    }
    return { body: { id: 9 } };
  });

  const status = await testRadarr("http://radarr.local:7878", "radarr-key");
  assert.equal(status.instanceName, "Home");
  const state = await radarrMovieState("http://radarr.local:7878", "radarr-key", 550);
  assert.deepEqual(state, { inLibrary: true, downloaded: true });
  const missing = await radarrMovieState("http://radarr.local:7878/", "radarr-key", 999);
  assert.deepEqual(missing, { inLibrary: false, downloaded: false });
  await addMovieToRadarr("http://radarr.local:7878", "radarr-key", 550, {
    qualityProfileId: 6,
    rootFolderPath: "/movies",
    searchForMovie: false,
  });

  for (const call of calls) {
    assert.equal(call.url.includes("radarr-key"), false);
    assert.equal(header(call.init, "X-Api-Key"), "radarr-key");
  }
  const post = calls.find((call) => call.init.method === "POST");
  assert.ok(post);
  const body = JSON.parse(String(post.init.body));
  assert.equal(body.addOptions.searchForMovie, false);
  assert.equal(body.rootFolderPath, "/movies");
  assert.equal(body.qualityProfileId, 6);
  assert.equal(body.id, undefined);
});

test("calendar export still escapes commas", () => {
  const ics = buildIcs([{ uid: "a", title: "Show, pilot", start: "2026-11-02" }], new Date("2026-10-22T00:00:00Z"));
  assert.match(ics, /SUMMARY:Show\\, pilot/);
});
