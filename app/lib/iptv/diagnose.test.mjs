import assert from "node:assert/strict";
import test from "node:test";

import { diagnoseM3u, diagnoseXtream } from "./diagnose.mjs";
import { androidWireHeaders, fetchPlaylist, playlistHeaders, resolveUserAgent } from "./http.mjs";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return typeof body === "string" ? body : JSON.stringify(body);
    },
  };
}

test("playlist headers match VLC and OkHttp does not add gzip when Range is set", () => {
  const headers = playlistHeaders("IPTVSmartersPlayer");
  assert.equal(headers["User-Agent"], "IPTVSmartersPlayer");
  assert.equal(headers.Accept, "*/*");
  assert.equal(headers.Range, "bytes=0-");
  assert.equal(headers["Icy-MetaData"], "1");
  assert.equal(Object.hasOwn(headers, "Referer"), false);
  assert.equal(Object.hasOwn(headers, "Origin"), false);
  assert.equal(Object.hasOwn(headers, "Accept-Encoding"), false);
  assert.equal(Object.hasOwn(headers, "Accept-Language"), false);
  assert.equal(Object.hasOwn(headers, "Cookie"), false);
  const wire = androidWireHeaders(headers);
  assert.equal(wire["Accept-Encoding"], undefined);
  assert.equal(wire.Connection, "Keep-Alive");
  const previous = androidWireHeaders({
    "User-Agent": "VLC/3.0.21 LibVLC/3.0.21",
    Accept: "application/json, application/vnd.apple.mpegurl, */*",
  });
  assert.equal(previous["Accept-Encoding"], "gzip");
  assert.equal(previous["User-Agent"], "VLC/3.0.21 LibVLC/3.0.21");
  assert.equal(resolveUserAgent("smarters", "ignored"), "IPTVSmartersPlayer");
  assert.equal(resolveUserAgent("tivimate", ""), "TiviMate/4.7.0");
  assert.equal(resolveUserAgent("okhttp", ""), "okhttp/4.9.2");
  assert.equal(resolveUserAgent("custom", "Mine/1"), "Mine/1");
});

test("a later live-categories 403 is named and the password stays out of the report", async () => {
  const fetchImpl = async (url, init) => {
    assert.equal(init.method, "GET");
    assert.equal(init.redirect, "follow");
    assert.equal(init.headers["User-Agent"], "IPTVSmartersPlayer");
    assert.equal(init.headers.Referer, undefined);
    assert.equal(init.headers.Origin, undefined);
    const action = new URL(url).searchParams.get("action") || "";
    if (!action) return jsonResponse(200, { user_info: { auth: 1 } });
    if (action === "get_live_categories") {
      return jsonResponse(403, "<html><title>403 Forbidden</title></html>");
    }
    throw new Error(`unexpected action ${action}`);
  };

  const lines = await diagnoseXtream({
    server: "https://example.com:8080",
    username: "ada",
    password: "secret-token",
    userAgent: "IPTVSmartersPlayer",
    fetchImpl,
  });
  const text = lines.join("\n");
  assert.match(text, /User agent: IPTVSmartersPlayer/);
  assert.match(text, /Referer: not sent/);
  assert.match(text, /Accept-Encoding: not sent/);
  assert.match(text, /Range: bytes=0-/);
  assert.match(text, /Sign in: OK/);
  assert.match(text, /Live categories: HTTP 403: 403 Forbidden/);
  assert.match(text, /Response: HTTP 403/);
  assert.equal(text.includes("secret-token"), false);
  assert.equal(text.includes("example.com"), false);
});

test("sign-in over the other scheme is reported when https is refused", async () => {
  const fetchImpl = async (url) => {
    if (new URL(url).protocol === "https:") return jsonResponse(403, "403 Forbidden");
    return jsonResponse(200, { user_info: { auth: 1 } });
  };
  const text = (
    await diagnoseXtream({
      server: "https://example.com",
      username: "ada",
      password: "panel-pass",
      userAgent: "okhttp/4.9.2",
      fetchImpl,
    })
  ).join("\n");
  assert.match(text, /Sign in: HTTP 403: 403 Forbidden/);
  assert.match(text, /Sign in over http: OK/);
  assert.equal(text.includes("panel-pass"), false);
  assert.equal(text.includes("example.com"), false);
});

test("an M3U 403 names the playlist step and tries the other scheme", async () => {
  const fetchImpl = async (url) => {
    if (String(url).startsWith("https:")) return jsonResponse(403, "403 Forbidden");
    return jsonResponse(200, "#EXTM3U\n#EXTINF:-1,One\nhttp://example.com/a.m3u8\n");
  };
  const text = (
    await diagnoseM3u({
      url: "https://example.com/list.m3u8",
      userAgent: "VLC/3.0.21 LibVLC/3.0.21",
      fetchImpl,
    })
  ).join("\n");
  assert.match(text, /Playlist: HTTP 403: 403 Forbidden/);
  assert.match(text, /Playlist over http: OK/);
  assert.equal(text.includes("example.com"), false);
});

test("fetchPlaylist prefixes the failing step", async () => {
  const fetchImpl = async () => jsonResponse(403, "403 Forbidden");
  await assert.rejects(
    () =>
      fetchPlaylist("http://example.com/player_api.php?password=secret", {
        fetchImpl,
        step: "Live categories",
        userAgent: "okhttp/4.9.2",
      }),
    (error) => {
      assert.equal(error.message, "Live categories: HTTP 403: 403 Forbidden");
      assert.equal(error.step, "Live categories");
      assert.equal(error.message.includes("secret"), false);
      return true;
    },
  );
});
