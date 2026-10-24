import assert from "node:assert/strict";
import test from "node:test";

import { joinApi, normalizeServerUrl } from "./url.mjs";

test("normalizes a server origin and keeps a reverse-proxy path", () => {
  assert.equal(normalizeServerUrl("http://192.168.1.20:8096/"), "http://192.168.1.20:8096");
  assert.equal(
    normalizeServerUrl("https://media.example/jellyfin/"),
    "https://media.example/jellyfin",
  );
  assert.throws(() => normalizeServerUrl("ftp://example.com"), /http/);
  assert.throws(() => normalizeServerUrl("not a url"), /full URL/);
});

test("joins an API path without duplicating slashes", () => {
  assert.equal(
    joinApi("http://nas:8096/", "/Users/Me"),
    "http://nas:8096/Users/Me",
  );
});
