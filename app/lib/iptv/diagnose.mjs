/**
 * Connection checks for a playlist the viewer typed in.
 * The report names the step and never includes the request URL.
 */

import { exchangePlaylist, formatExchangeReport, resolveUserAgent } from "./http.mjs";
import { xtreamApiUrl } from "./xtream.mjs";

function schemeOf(server) {
  try {
    return new URL(String(server).trim()).protocol;
  } catch {
    return "";
  }
}

export function swapScheme(server) {
  const url = new URL(String(server).trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  url.protocol = url.protocol === "https:" ? "http:" : "https:";
  return url.toString();
}

async function probe(step, url, userAgent, fetchImpl) {
  const exchange = await exchangePlaylist(url, { userAgent, fetchImpl, step });
  return exchange;
}

function failureLines(error) {
  const message = error instanceof Error ? error.message : "The request failed.";
  const report = error && error.exchange ? formatExchangeReport(error.exchange) : [];
  return [message, ...report];
}

/**
 * Sign in, then one small category call. If sign-in fails, the other scheme
 * is tried once and reported as its own line.
 * @param {{ server: string, username: string, password: string, userAgent?: string, fetchImpl?: typeof fetch }} input
 */
export async function diagnoseXtream({ server, username, password, userAgent, fetchImpl }) {
  const agent = resolveUserAgent(undefined, userAgent);
  const lines = [`User agent: ${agent}`];
  const signIn = xtreamApiUrl(server, username, password, "");
  try {
    const exchange = await probe("Sign in", signIn, agent, fetchImpl);
    lines.push("Sign in: OK", ...formatExchangeReport(exchange));
  } catch (error) {
    lines.push(...failureLines(error));
    const alt = swapScheme(server);
    if (alt) {
      const label = schemeOf(alt).replace(":", "");
      try {
        const exchange = await probe("Sign in", xtreamApiUrl(alt, username, password, ""), agent, fetchImpl);
        lines.push(`Sign in over ${label}: OK. Save the server with that address.`, ...formatExchangeReport(exchange));
      } catch (altError) {
        const message = altError instanceof Error ? altError.message : "failed";
        lines.push(message.replace(/^Sign in/, `Sign in over ${label}`));
        if (altError && altError.exchange) lines.push(...formatExchangeReport(altError.exchange));
      }
    }
    return lines;
  }
  try {
    const exchange = await probe(
      "Live categories",
      xtreamApiUrl(server, username, password, "get_live_categories"),
      agent,
      fetchImpl,
    );
    lines.push("Live categories: OK", ...formatExchangeReport(exchange));
  } catch (error) {
    lines.push(...failureLines(error));
  }
  return lines;
}

/**
 * @param {{ url: string, userAgent?: string, fetchImpl?: typeof fetch }} input
 */
export async function diagnoseM3u({ url, userAgent, fetchImpl }) {
  const agent = resolveUserAgent(undefined, userAgent);
  const lines = [`User agent: ${agent}`];
  try {
    const exchange = await probe("Playlist", url, agent, fetchImpl);
    lines.push(exchange.body.includes("#EXTM3U") ? "Playlist: OK" : "Playlist: OK, but the file is not an M3U playlist.");
    lines.push(...formatExchangeReport(exchange));
  } catch (error) {
    lines.push(...failureLines(error));
    const alt = swapScheme(url);
    if (alt) {
      const label = schemeOf(alt).replace(":", "");
      try {
        const exchange = await probe("Playlist", alt, agent, fetchImpl);
        lines.push(`Playlist over ${label}: OK. Save the playlist with that address.`);
        lines.push(...formatExchangeReport(exchange));
      } catch (altError) {
        const message = altError instanceof Error ? altError.message : "failed";
        lines.push(message.replace(/^Playlist/, `Playlist over ${label}`));
        if (altError && altError.exchange) lines.push(...formatExchangeReport(altError.exchange));
      }
    }
  }
  return lines;
}
