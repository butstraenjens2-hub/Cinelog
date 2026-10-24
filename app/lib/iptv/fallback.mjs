/**
 * Extra ways to read a playlist the viewer supplied.
 * OkHttp runs first. libVLC and the Xtream API run only when that
 * download fails or parses to nothing. Reports never include the address.
 */

import { formatExchangeReport } from "./http.mjs";
import { sectionCounts } from "./m3u.mjs";

export function credentialsFromPlaylistUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value ?? "").trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const username = parsed.searchParams.get("username") || "";
  const password = parsed.searchParams.get("password") || "";
  if (!username || !password) return null;
  const directory = parsed.pathname.replace(/[^/]*$/, "").replace(/\/+$/, "");
  const server = `${parsed.origin}${directory}`;
  return { server, username, password };
}

export function safeDiagnostic(value) {
  return String(value ?? "")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/password=[^\s&]*/gi, "password=(hidden)")
    .replace(/username=[^\s&]*/gi, "username=(hidden)")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export function formatLoadReport(attempts) {
  const lines = ["Fallbacks:"];
  for (const attempt of attempts || []) {
    lines.push(`Tried: ${attempt.name}`);
    if (attempt.outcome) lines.push(attempt.outcome);
    if (attempt.status) lines.push(`HTTP ${attempt.status}`);
    if (attempt.contentType) lines.push(`Content-Type: ${attempt.contentType}`);
    if (Number.isFinite(attempt.bytes)) lines.push(`Bytes: ${attempt.bytes}`);
    if (attempt.snippet) lines.push(`Preview: ${safeDiagnostic(String(attempt.snippet).slice(0, 200))}`);
    if (attempt.error) lines.push(safeDiagnostic(attempt.error));
    for (const line of attempt.details || []) {
      const clean = safeDiagnostic(line);
      if (clean) lines.push(clean);
    }
  }
  return lines.join("\n");
}

function contentTypeOf(exchange) {
  const headers = exchange?.responseHeaders || {};
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === "content-type") return String(value || "").split(";")[0].trim();
  }
  return "";
}

function cancelled(cause) {
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  return message === "Cancelled" || message.includes("Cancelled");
}

/**
 * `loadOkHttp`, `loadVlc`, and `loadXtream` are injected so tests can
 * simulate each step. `loadVlc` returns null when libVLC is not on the device.
 * `loadXtream` receives `{ server, username, password }` and is skipped when
 * the address has no login.
 */
export async function loadPlaylistFallbacks({ url, loadOkHttp, loadVlc, loadXtream }) {
  const attempts = [];
  let loaded = null;
  let first = null;

  try {
    const result = await loadOkHttp();
    first = result;
    attempts.push({
      name: "OkHttp",
      outcome: result.items?.length ? `${result.items.length} items` : "0 items",
      status: result.diagnosis?.status || 0,
      contentType: result.diagnosis?.contentType || "",
      bytes: result.diagnosis?.bytes,
      snippet: result.diagnosis?.snippet || "",
      details: result.items?.length ? [] : result.diagnosis?.details || [],
    });
    if (result.items?.length) loaded = { ...result, via: "OkHttp" };
  } catch (cause) {
    if (cancelled(cause)) throw cause;
    const exchange = cause && typeof cause === "object" ? cause.exchange : null;
    attempts.push({
      name: "OkHttp",
      outcome: "failed",
      status: Number(exchange?.status || 0),
      contentType: contentTypeOf(exchange),
      snippet: typeof exchange?.body === "string" ? exchange.body.slice(0, 200) : "",
      error: cause instanceof Error ? cause.message : "failed",
      details: exchange ? formatExchangeReport(exchange) : [],
    });
  }

  if (!loaded && loadVlc) {
    try {
      const vlc = await loadVlc();
      if (!vlc) {
        attempts.push({ name: "libVLC", outcome: "not available" });
      } else {
        attempts.push({
          name: "libVLC",
          outcome: vlc.items?.length ? `${vlc.items.length} items` : vlc.reason || "0 items",
        });
        if (vlc.items?.length) {
          loaded = {
            items: vlc.items,
            counts: sectionCounts(vlc.items),
            diagnosis: null,
            warnings: ["Loaded with libVLC."],
            via: "libVLC",
          };
        }
      }
    } catch (cause) {
      if (cancelled(cause)) throw cause;
      attempts.push({ name: "libVLC", outcome: "failed", error: cause instanceof Error ? cause.message : "failed" });
    }
  }

  if (!loaded && loadXtream) {
    const creds = credentialsFromPlaylistUrl(url);
    if (!creds) {
      attempts.push({
        name: "Xtream API",
        outcome: "skipped",
        error: "The playlist address has no username and password to try the API.",
      });
    } else {
      try {
        const catalogue = await loadXtream(creds);
        const warnings = Array.isArray(catalogue?.warnings) ? catalogue.warnings : [];
        attempts.push({
          name: "Xtream API",
          outcome: catalogue?.items?.length ? `${catalogue.items.length} items` : "0 items",
          error: warnings.join(" "),
        });
        if (catalogue?.items?.length) {
          loaded = {
            items: catalogue.items,
            counts: sectionCounts(catalogue.items),
            diagnosis: null,
            warnings: ["Loaded with the Xtream API.", ...warnings],
            via: "Xtream API",
          };
        }
      } catch (cause) {
        if (cancelled(cause)) throw cause;
        attempts.push({ name: "Xtream API", outcome: "failed", error: cause instanceof Error ? cause.message : "failed" });
      }
    }
  }

  const neededReport = !loaded || attempts.length > 1;
  const report = neededReport ? formatLoadReport(attempts) : "";
  if (loaded) return { ...loaded, report };
  return {
    items: [],
    counts: { live: 0, movie: 0, series: 0 },
    diagnosis: {
      reason: first?.diagnosis?.reason || attempts.at(-1)?.error || attempts.at(-1)?.outcome || "not #EXTM3U",
      snippet: first?.diagnosis?.snippet || "",
      status: Number(first?.diagnosis?.status || 0),
      contentType: first?.diagnosis?.contentType || "",
      bytes: Number(first?.diagnosis?.bytes || 0),
      details: report.split("\n"),
    },
    warnings: [],
    report,
  };
}
