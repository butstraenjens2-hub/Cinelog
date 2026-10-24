import assert from "node:assert/strict";
import test from "node:test";

import { buildIcs } from "@/lib/calendar/ics.mjs";
import { jellyfinReportProgress, jellyfinResume, jellyfinStreamUrl } from "@/lib/jellyfin/api";

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
    assert.match(header(call.init, "X-Emby-Authorization"), /Version="1\.0\.45"/);
    assert.equal(header(call.init, "X-Emby-Token"), "jelly-token");
  }
  const progress = calls.find((call) => call.url.includes("/Sessions/Playing/Progress"));
  assert.ok(progress);
  const body = JSON.parse(String(progress.init.body));
  assert.equal(body.PositionTicks, 200_000_000);
  assert.equal(body.ItemId, "item-1");
  assert.equal(body.EventName, "TimeUpdate");
});

test("calendar export still escapes commas", () => {
  const ics = buildIcs([{ uid: "a", title: "Show, pilot", start: "2026-11-02" }], new Date("2026-10-22T00:00:00Z"));
  assert.match(ics, /SUMMARY:Show\\, pilot/);
});
