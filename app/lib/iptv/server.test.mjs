import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { fetchPlaylist } from "./http.mjs";
import { createM3uParser } from "./m3u.mjs";
import { playbackPlan } from "./playback.mjs";
import { xtreamLiveUrl, xtreamVodUrl, xtreamEpisodeUrl } from "./xtream.mjs";

function tsPacket() {
  const packet = Buffer.alloc(188, 0xff);
  packet[0] = 0x47;
  return packet;
}

test("a mock Xtream server redirects, serves m3u_plus in chunks, and plays ts and hls", async () => {
  const seen = [];
  const playlist = [
    "#EXTM3U",
    '#EXTINF:-1 tvg-id="news" group-title="News",Desk',
    "http://127.0.0.1/live/ada/secret-token/1.ts",
    '#EXTINF:-1 group-title="Films",Tape',
    "http://127.0.0.1/movie/ada/secret-token/2.mp4",
    '#EXTINF:-1 group-title="Shows",Serial',
    "http://127.0.0.1/series/ada/secret-token/3.mkv",
    "",
  ].join("\n");

  const server = http.createServer((request, response) => {
    seen.push({ url: request.url, headers: request.headers });
    if (request.url?.startsWith("/get.php")) {
      response.writeHead(302, { Location: "/list.m3u" });
      response.end();
      return;
    }
    if (request.url === "/list.m3u") {
      response.writeHead(200, { "Content-Type": "audio/x-mpegurl" });
      let offset = 0;
      const timer = setInterval(() => {
        response.write(playlist.slice(offset, offset + 24));
        offset += 24;
        if (offset >= playlist.length) {
          clearInterval(timer);
          response.end();
        }
      }, 1);
      return;
    }
    if (request.url === "/live/ada/secret-token/1.ts") {
      response.writeHead(200, { "Content-Type": "video/mp2t" });
      response.end(tsPacket());
      return;
    }
    if (request.url === "/live/ada/secret-token/1.m3u8") {
      response.writeHead(200, { "Content-Type": "application/vnd.apple.mpegurl" });
      response.end("#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:4.0,\nseg.ts\n#EXT-X-ENDLIST\n");
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  try {
    const parser = createM3uParser();
    const body = await fetchPlaylist(`${origin}/get.php?username=ada&password=secret-token&type=m3u_plus&output=ts`, {
      userAgent: "VLC/3.0.21 LibVLC/3.0.21",
    });
    for (let index = 0; index < body.length; index += 17) parser.push(body.slice(index, index + 17));
    const items = parser.finish();
    assert.equal(items.length, 3);
    assert.equal(items[0].kind, "live");
    assert.equal(items[0].name, "Desk");
    assert.equal(items[1].kind, "movie");
    assert.equal(items[2].kind, "series");
    assert.equal(playbackPlan(items[0].url).source, "mpegts");
    assert.equal(playbackPlan(items[0].url).mime, "video/mp2t");
    assert.equal(playbackPlan(items[1].url).mime, "video/mp4");
    assert.equal(playbackPlan(items[2].url).mime, "video/x-matroska");

    const hop = seen.find((call) => call.url.startsWith("/get.php"));
    const list = seen.find((call) => call.url === "/list.m3u");
    for (const call of [hop, list]) {
      assert.equal(call.headers["user-agent"], "VLC/3.0.21 LibVLC/3.0.21");
      assert.equal(call.headers.accept, "*/*");
      assert.equal(call.headers.range, "bytes=0-");
      assert.equal(call.headers["icy-metadata"], "1");
      assert.equal(call.headers.cookie, undefined);
    }
    assert.equal(body.includes("secret-token"), true);

    const tsUrl = `${origin}/live/ada/secret-token/1.ts`;
    const ts = await fetchPlaylist(tsUrl, { userAgent: "VLC/3.0.21 LibVLC/3.0.21" });
    assert.equal(ts.charCodeAt(0), 0x47);
    assert.equal(playbackPlan(tsUrl).source, "mpegts");

    const hlsUrl = xtreamLiveUrl(origin, "ada", "secret-token", 1, "m3u8");
    assert.match(hlsUrl, /\/live\/ada\/secret-token\/1\.m3u8$/);
    const hls = await fetchPlaylist(hlsUrl, { userAgent: "IPTVSmartersPlayer" });
    assert.match(hls, /#EXTM3U/);
    assert.equal(playbackPlan(hlsUrl).source, "hls");
    assert.equal(seen.at(-1).headers["user-agent"], "IPTVSmartersPlayer");

    assert.match(xtreamVodUrl(origin, "ada", "p@ss", 2, "mp4"), /\/movie\/ada\/p%40ss\/2\.mp4$/);
    assert.match(xtreamEpisodeUrl(origin, "ada", "p@ss", 3, "mkv"), /\/series\/ada\/p%40ss\/3\.mkv$/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
