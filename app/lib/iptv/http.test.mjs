import assert from "node:assert/strict";
import http from "node:http";
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

test("a local echo server receives the player name, VLC headers, and an unchanged query", async () => {
  const seen = [];
  const server = http.createServer((request, response) => {
    seen.push({ url: request.url, headers: request.headers });
    if (String(request.url).startsWith("/hop")) {
      response.writeHead(302, {
        Location: "/get.php?username=ada&password=secret-token&type=m3u_plus&output=ts",
      });
      response.end();
      return;
    }
    response.writeHead(200, { "Content-Type": "audio/x-mpegurl", Server: "echo" });
    response.end("#EXTM3U\n");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const body = await fetchPlaylist(
      `http://127.0.0.1:${port}/get.php?username=ada&password=secret-token&type=m3u_plus&output=ts`,
      { userAgent: DEFAULT_IPTV_USER_AGENT },
    );
    assert.match(body, /#EXTM3U/);
    assert.equal(seen[0].headers["user-agent"], DEFAULT_IPTV_USER_AGENT);
    assert.equal(seen[0].headers.accept, "*/*");
    assert.equal(seen[0].headers.range, "bytes=0-");
    assert.equal(seen[0].headers["icy-metadata"], "1");
    assert.equal(seen[0].headers.cookie, undefined);
    assert.equal(seen[0].headers["user-agent"].includes("okhttp"), false);
    assert.equal(
      seen[0].url,
      "/get.php?username=ada&password=secret-token&type=m3u_plus&output=ts",
    );

    seen.length = 0;
    await fetchPlaylist(`http://127.0.0.1:${port}/hop`, { userAgent: "IPTVSmartersPlayer" });
    assert.equal(seen[0].headers["user-agent"], "IPTVSmartersPlayer");
    assert.equal(seen[1].headers["user-agent"], "IPTVSmartersPlayer");
    assert.equal(seen[1].headers.range, "bytes=0-");
    assert.equal(seen[1].headers["icy-metadata"], "1");
    assert.match(seen[1].url, /password=secret-token/);
    assert.equal(seen[1].url.startsWith("https:"), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("formatHttpError keeps a JSON server message and the status", () => {
  assert.equal(
    formatHttpError(403, JSON.stringify({ message: "Invalid user agent" })),
    "HTTP 403: Invalid user agent",
  );
  assert.equal(formatHttpError(502, "   "), "HTTP 502");
});
