/**
 * JSON-RPC remote for the viewer's own Kodi. This does not install add-ons.
 */

import { kodiRpc } from "@/lib/kodi/rpc.mjs";
import { asRecord, asText, ownFetch } from "@/lib/own-server/http";

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
