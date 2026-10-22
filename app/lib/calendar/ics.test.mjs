import assert from "node:assert/strict";
import test from "node:test";

import { buildIcs } from "./ics.mjs";
import { directStreamPath, mediaBrowserAuthHeader } from "../jellyfin/urls.mjs";
import { kodiRpc } from "../kodi/rpc.mjs";
import { simklBucket } from "../simkl/map.mjs";

test("buildIcs writes all-day events and drops incomplete rows", () => {
  const ics = buildIcs(
    [
      { uid: "series:1:s1e2", title: "Show, pilot", start: "2026-11-02", description: "S01E02" },
      { uid: "", title: "Missing", start: "2026-11-03" },
    ],
    new Date("2026-10-22T12:00:00Z"),
  );
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261102/);
  assert.match(ics, /SUMMARY:Show\\, pilot/);
  assert.equal(ics.includes("Missing"), false);
  assert.equal(ics.endsWith("\r\n"), true);
});

test("jellyfin direct stream stays on the server path and does not embed a key", () => {
  const path = directStreamPath("abc/1", "src 2");
  assert.equal(path.includes("api_key"), false);
  assert.match(path, /^\/Videos\/abc%2F1\/stream\?static=true&MediaSourceId=src%202$/);
  const header = mediaBrowserAuthHeader("1.0.38");
  assert.match(header, /Client="CineLog"/);
  assert.match(header, /Version="1\.0\.38"/);
});

test("kodi rpc body is JSON-RPC 2.0 and omits empty params", () => {
  assert.deepEqual(kodiRpc("JSONRPC.Ping"), { jsonrpc: "2.0", id: 1, method: "JSONRPC.Ping" });
  assert.deepEqual(kodiRpc("Input.ExecuteAction", { action: "back" }, 4).params.action, "back");
});

test("simkl statuses map to watchlist or progress", () => {
  assert.equal(simklBucket("plantowatch"), "watchlist");
  assert.equal(simklBucket("completed"), "progress");
  assert.equal(simklBucket("dropped"), null);
});
