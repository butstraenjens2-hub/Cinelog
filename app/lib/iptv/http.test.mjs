import assert from "node:assert/strict";
import test from "node:test";

import { xtreamApiUrl } from "./xtream.mjs";
import {
  DEFAULT_IPTV_USER_AGENT,
  fetchPlaylist,
  formatHttpError,
} from "./http.mjs";

function mockFetch(handler) {
  return async (url, init) => handler(String(url), init);
}

test("a browser user agent is refused and the 403 body is shown for M3U and Xtream", async () => {
  const calls = [];
  const fetchImpl = mockFetch(async (url, init) => {
    calls.push({
      url,
      method: init.method,
      redirect: init.redirect,
      userAgent: init.headers["User-Agent"],
    });
    if (init.headers["User-Agent"] !== DEFAULT_IPTV_USER_AGENT) {
      return {
        ok: false,
        status: 403,
        async text() {
          return "<html><title>403 Forbidden</title><body>browser blocked</body></html>";
        },
      };
    }
    if (url.includes("player_api.php")) {
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify([{ category_id: "1", category_name: "News" }]);
        },
      };
    }
    return {
      ok: true,
      status: 200,
      async text() {
        return "#EXTM3U\n#EXTINF:-1,One\nhttp://example.com/live/one.m3u8\n";
      },
    };
  });

  await assert.rejects(
    () => fetchPlaylist("http://example.com/list.m3u8", { userAgent: "Mozilla/5.0", fetchImpl }),
    (error) => {
      assert.match(error.message, /^HTTP 403:/);
      assert.match(error.message, /403 Forbidden/);
      assert.equal(error.message.includes("example.com"), false);
      return true;
    },
  );

  const api = xtreamApiUrl("http://example.com:8080/portal", "ada", "secret", "get_live_categories");
  await assert.rejects(
    () => fetchPlaylist(api, { userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0", fetchImpl }),
    (error) => {
      assert.match(error.message, /HTTP 403/);
      assert.equal(error.message.includes("secret"), false);
      return true;
    },
  );
  assert.match(calls[1].url, /^http:\/\/example\.com:8080\/portal\/player_api\.php\?/);
  assert.equal(calls[1].method, "GET");
  assert.equal(calls[1].redirect, "follow");

  const playlist = await fetchPlaylist("http://example.com/list.m3u8", { fetchImpl });
  assert.match(playlist, /#EXTM3U/);
  assert.equal(calls.at(-1).userAgent, DEFAULT_IPTV_USER_AGENT);
  assert.equal(calls.at(-1).method, "GET");
  assert.equal(DEFAULT_IPTV_USER_AGENT.includes("Mozilla"), false);
});

test("formatHttpError keeps a JSON server message and the status", () => {
  assert.equal(
    formatHttpError(403, JSON.stringify({ message: "Invalid user agent" })),
    "HTTP 403: Invalid user agent",
  );
  assert.equal(formatHttpError(502, "   "), "HTTP 502");
});
