import assert from "node:assert/strict";
import test from "node:test";

import { loadXtreamCatalogue } from "./load.ts";

function json(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return typeof body === "string" ? body : JSON.stringify(body);
    },
  };
}

test("a movie 403 is named and live channels still load", async () => {
  const original = globalThis.fetch;
  const agents: string[] = [];
  globalThis.fetch = (async (url: string, init: { method?: string; headers?: Record<string, string> }) => {
    agents.push(init.headers?.["User-Agent"] ?? "");
    assert.equal(init.method, "GET");
    assert.equal(init.headers?.Referer, undefined);
    assert.equal(init.headers?.Origin, undefined);
    const action = new URL(url).searchParams.get("action") || "";
    if (!action) return json(200, { user_info: { auth: 1, message: "ok" } });
    if (action === "get_live_categories") return json(200, [{ category_id: "1", category_name: "News" }]);
    if (action === "get_live_streams") return json(200, [{ stream_id: 9, name: "Desk", category_id: "1" }]);
    if (action === "get_vod_streams") return json(403, "<html><title>403 Forbidden</title></html>");
    return json(200, []);
  }) as typeof fetch;
  try {
    const catalogue = await loadXtreamCatalogue(
      "http://example.com:8080",
      "ada",
      "secret-token",
      "IPTVSmartersPlayer",
    );
    assert.equal(catalogue.items.some((item) => item.name === "Desk" && item.kind === "live"), true);
    assert.match(catalogue.warnings.join("\n"), /Movies: HTTP 403: 403 Forbidden/);
    assert.equal(agents.every((agent) => agent === "IPTVSmartersPlayer"), true);
    assert.equal(JSON.stringify(catalogue).includes("secret-token"), false);
  } finally {
    globalThis.fetch = original;
  }
});

test("a refused sign-in names that step and stops", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => json(403, "403 Forbidden")) as typeof fetch;
  try {
    await assert.rejects(
      () => loadXtreamCatalogue("http://example.com", "ada", "secret-token", "okhttp/4.9.2"),
      (error: unknown) => {
        assert.equal(error instanceof Error && error.message, "Sign in: HTTP 403: 403 Forbidden");
        assert.equal(error instanceof Error && error.message.includes("secret-token"), false);
        return true;
      },
    );
  } finally {
    globalThis.fetch = original;
  }
});
