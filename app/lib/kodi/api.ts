/**
 * JSON-RPC remote for the viewer's own Kodi. This does not install add-ons.
 */

import { kodiRpc } from "@/lib/kodi/rpc.mjs";
import { asNumber, asRecord, asText, ownFetch } from "@/lib/own-server/http";

function headers(username: string, password: string): Record<string, string> {
  if (!username.trim()) return {};
  const token = globalThis.btoa(`${username}:${password}`);
  return { Authorization: `Basic ${token}` };
}

async function rpc<T>(
  baseUrl: string,
  username: string,
  password: string,
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const raw = await ownFetch<Record<string, unknown>>(baseUrl, "/jsonrpc", {
    method: "POST",
    headers: headers(username, password),
    body: kodiRpc(method, params),
  });
  if (raw.error) {
    const error = asRecord(raw.error);
    throw new Error(asText(error.message) || "Kodi refused the command.");
  }
  return raw.result as T;
}

export async function testKodi(baseUrl: string, username: string, password: string): Promise<string> {
  const result = await rpc<string>(baseUrl, username, password, "JSONRPC.Ping");
  return result || "pong";
}

export async function kodiNowPlaying(
  baseUrl: string,
  username: string,
  password: string,
): Promise<string> {
  const players = await rpc<Array<{ playerid?: number; type?: string }>>(
    baseUrl,
    username,
    password,
    "Player.GetActivePlayers",
  );
  const player = players?.[0];
  if (!player || player.playerid == null) return "";
  const item = await rpc<Record<string, unknown>>(baseUrl, username, password, "Player.GetItem", {
    playerid: player.playerid,
    properties: ["title", "showtitle", "season", "episode"],
  });
  const info = asRecord(item.item);
  const show = asText(info.showtitle);
  const title = asText(info.title) || "Playing";
  if (show) {
    const season = Number(info.season);
    const episode = Number(info.episode);
    const code = Number.isFinite(season) && Number.isFinite(episode)
      ? ` S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`
      : "";
    return `${show}${code} · ${title}`;
  }
  return title;
}

export interface KodiLibraryItem {
  id: number;
  title: string;
  kind: "movie" | "show" | "episode";
  meta: string;
}

export async function kodiMovies(baseUrl: string, username: string, password: string): Promise<KodiLibraryItem[]> {
  const result = await rpc<Record<string, unknown>>(baseUrl, username, password, "VideoLibrary.GetMovies", {
    properties: ["title", "year"],
  });
  const rows = Array.isArray(result.movies) ? result.movies : [];
  return rows.map((row) => {
    const raw = asRecord(row);
    return {
      id: asNumber(raw.movieid),
      title: asText(raw.title) || asText(raw.label) || "Movie",
      kind: "movie" as const,
      meta: asNumber(raw.year) ? String(asNumber(raw.year)) : "",
    };
  }).filter((item) => item.id);
}

export async function kodiShows(baseUrl: string, username: string, password: string): Promise<KodiLibraryItem[]> {
  const result = await rpc<Record<string, unknown>>(baseUrl, username, password, "VideoLibrary.GetTVShows", {
    properties: ["title", "year"],
  });
  const rows = Array.isArray(result.tvshows) ? result.tvshows : [];
  return rows.map((row) => {
    const raw = asRecord(row);
    return {
      id: asNumber(raw.tvshowid),
      title: asText(raw.title) || asText(raw.label) || "Series",
      kind: "show" as const,
      meta: "show",
    };
  }).filter((item) => item.id);
}

export async function kodiEpisodes(
  baseUrl: string,
  username: string,
  password: string,
  showId: number,
): Promise<KodiLibraryItem[]> {
  const result = await rpc<Record<string, unknown>>(baseUrl, username, password, "VideoLibrary.GetEpisodes", {
    tvshowid: showId,
    properties: ["title", "season", "episode"],
  });
  const rows = Array.isArray(result.episodes) ? result.episodes : [];
  return rows.map((row) => {
    const raw = asRecord(row);
    const season = asNumber(raw.season);
    const episode = asNumber(raw.episode);
    return {
      id: asNumber(raw.episodeid),
      title: asText(raw.title) || "Episode",
      kind: "episode" as const,
      meta: `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`,
    };
  }).filter((item) => item.id);
}

export async function kodiPlay(
  baseUrl: string,
  username: string,
  password: string,
  item: { movieid?: number; episodeid?: number },
): Promise<void> {
  await rpc(baseUrl, username, password, "Player.Open", { item });
}

export function kodiInput(
  baseUrl: string,
  username: string,
  password: string,
  action: "up" | "down" | "left" | "right" | "select" | "back" | "home" | "playpause" | "stop",
): Promise<void> {
  if (action === "playpause" || action === "stop") {
    return kodiPlayer(baseUrl, username, password, action);
  }
  const method =
    action === "up"
      ? "Input.Up"
      : action === "down"
        ? "Input.Down"
        : action === "left"
          ? "Input.Left"
          : action === "right"
            ? "Input.Right"
            : action === "select"
              ? "Input.Select"
              : action === "back"
                ? "Input.Back"
                : "Input.Home";
  return rpc(baseUrl, username, password, method).then(() => undefined);
}

async function kodiPlayer(
  baseUrl: string,
  username: string,
  password: string,
  action: "playpause" | "stop",
): Promise<void> {
  const players = await rpc<Array<{ playerid?: number }>>(baseUrl, username, password, "Player.GetActivePlayers");
  const playerid = players?.[0]?.playerid;
  if (playerid == null) return;
  const method = action === "stop" ? "Player.Stop" : "Player.PlayPause";
  await rpc(baseUrl, username, password, method, { playerid });
}
