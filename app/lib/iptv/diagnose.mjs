/**
 * Connection checks for a playlist the viewer typed in.
 * The report names the step and never includes the request URL.
 */

import { fetchPlaylist, resolveUserAgent } from "./http.mjs";
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
  const text = await fetchPlaylist(url, { userAgent, fetchImpl, step });
  return text;
}

/**
 * Sign in, then one small category call. If sign-in fails, the other scheme
 * is tried once and reported as its own line.
 * @param {{ server: string, username: string, password: string, userAgent?: string, fetchImpl?: typeof fetch }} input
 */
export async function diagnoseXtream({ server, username, password, userAgent, fetchImpl }) {
  const agent = resolveUserAgent(undefined, userAgent);
  const lines = [`User agent: ${agent}`, "Referer and Origin are not sent."];
  const signIn = xtreamApiUrl(server, username, password, "");
  try {
    await probe("Sign in", signIn, agent, fetchImpl);
    lines.push("Sign in: OK");
  } catch (error) {
    lines.push(error instanceof Error ? error.message : "Sign in failed.");
    const alt = swapScheme(server);
    if (alt) {
      const label = schemeOf(alt).replace(":", "");
      try {
        await probe("Sign in", xtreamApiUrl(alt, username, password, ""), agent, fetchImpl);
        lines.push(`Sign in over ${label}: OK. Save the server with that address.`);
      } catch (altError) {
        const message = altError instanceof Error ? altError.message : "failed";
        lines.push(message.replace(/^Sign in/, `Sign in over ${label}`));
      }
    }
    return lines;
  }
  try {
    await probe(
      "Live categories",
      xtreamApiUrl(server, username, password, "get_live_categories"),
      agent,
      fetchImpl,
    );
    lines.push("Live categories: OK");
  } catch (error) {
    lines.push(error instanceof Error ? error.message : "Live categories failed.");
  }
  return lines;
}

/**
 * @param {{ url: string, userAgent?: string, fetchImpl?: typeof fetch }} input
 */
export async function diagnoseM3u({ url, userAgent, fetchImpl }) {
  const agent = resolveUserAgent(undefined, userAgent);
  const lines = [`User agent: ${agent}`, "Referer and Origin are not sent."];
  try {
    const text = await probe("Playlist", url, agent, fetchImpl);
    lines.push(text.includes("#EXTM3U") ? "Playlist: OK" : "Playlist: OK, but the file is not an M3U playlist.");
  } catch (error) {
    lines.push(error instanceof Error ? error.message : "Playlist failed.");
    const alt = swapScheme(url);
    if (alt) {
      const label = schemeOf(alt).replace(":", "");
      try {
        await probe("Playlist", alt, agent, fetchImpl);
        lines.push(`Playlist over ${label}: OK. Save the playlist with that address.`);
      } catch (altError) {
        const message = altError instanceof Error ? altError.message : "failed";
        lines.push(message.replace(/^Playlist/, `Playlist over ${label}`));
      }
    }
  }
  return lines;
}
