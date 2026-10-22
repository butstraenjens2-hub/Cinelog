/**
 * Jellyfin and Emby public API for the viewer's own server.
 * Playback is a direct stream of a file on that server.
 */

import { directStreamPath, mediaBrowserAuthHeader } from "@/lib/jellyfin/urls.mjs";
import { asNumber, asRecord, asText, ownFetch } from "@/lib/own-server/http";

export interface JellyfinItem {
  id: string;
  name: string;
  kind: string;
  year: number;
  mediaSourceId: string;
}

function authHeaders(token: string): Record<string, string> {
  return {
    "X-Emby-Authorization": mediaBrowserAuthHeader("1.0.34"),
    ...(token ? { "X-Emby-Token": token } : {}),
  };
}

export async function jellyfinSignIn(
  baseUrl: string,
  username: string,
  password: string,
): Promise<{ token: string; userId: string; serverName: string }> {
  const raw = await ownFetch<Record<string, unknown>>(baseUrl, "/Users/AuthenticateByName", {
    method: "POST",
    headers: authHeaders(""),
    body: { Username: username.trim(), Pw: password },
  });
  const user = asRecord(raw.User);
  const token = asText(raw.AccessToken);
  const userId = asText(user.Id);
  if (!token || !userId) throw new Error("The server did not return a session.");
  const info = await jellyfinSystem(baseUrl, token);
  return { token, userId, serverName: info.serverName };
}

export async function jellyfinSystem(
  baseUrl: string,
  token: string,
): Promise<{ serverName: string; version: string }> {
  const raw = await ownFetch<Record<string, unknown>>(baseUrl, "/System/Info", {
    headers: authHeaders(token),
  });
  return {
    serverName: asText(raw.ServerName) || "Server",
    version: asText(raw.Version),
  };
}

export async function jellyfinUserId(baseUrl: string, token: string): Promise<string> {
  try {
    const me = await ownFetch<Record<string, unknown>>(baseUrl, "/Users/Me", {
      headers: authHeaders(token),
    });
    const id = asText(me.Id);
    if (id) return id;
  } catch {
    // An admin API key may not have /Users/Me. Fall through to the user list.
  }
  const users = await ownFetch<unknown[]>(baseUrl, "/Users", { headers: authHeaders(token) });
  const first = asRecord(Array.isArray(users) ? users[0] : null);
  const id = asText(first.Id);
  if (!id) throw new Error("The server did not list a user for this key.");
  return id;
}

export async function jellyfinEpisodes(
  baseUrl: string,
  token: string,
  userId: string,
  seriesId: string,
): Promise<JellyfinItem[]> {
  const page = await ownFetch<Record<string, unknown>>(baseUrl, `/Users/${encodeURIComponent(userId)}/Items`, {
    headers: authHeaders(token),
    query: {
      ParentId: seriesId,
      Recursive: true,
      IncludeItemTypes: "Episode",
      Limit: 40,
      SortBy: "IndexNumber",
      Fields: "MediaSources",
    },
  });
  const rows = Array.isArray(page.Items) ? page.Items : [];
  return rows.map((row) => {
    const raw = asRecord(row);
    const sources = Array.isArray(raw.MediaSources) ? raw.MediaSources : [];
    const source = asRecord(sources[0]);
    const season = asNumber(raw.ParentIndexNumber);
    const episode = asNumber(raw.IndexNumber);
    const code = season || episode ? `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")} ` : "";
    return {
      id: asText(raw.Id),
      name: `${code}${asText(raw.Name) || "Episode"}`.trim(),
      kind: "Episode",
      year: 0,
      mediaSourceId: asText(source.Id),
    };
  }).filter((item) => item.id);
}

export async function jellyfinItems(
  baseUrl: string,
  token: string,
  userId: string,
  startIndex = 0,
): Promise<JellyfinItem[]> {
  const page = await ownFetch<Record<string, unknown>>(baseUrl, `/Users/${encodeURIComponent(userId)}/Items`, {
    headers: authHeaders(token),
    query: {
      Recursive: true,
      IncludeItemTypes: "Movie,Series",
      Limit: 40,
      StartIndex: startIndex,
      SortBy: "DateCreated",
      SortOrder: "Descending",
      Fields: "MediaSources",
    },
  });
  const rows = Array.isArray(page.Items) ? page.Items : [];
  return rows.map((row) => {
    const raw = asRecord(row);
    const sources = Array.isArray(raw.MediaSources) ? raw.MediaSources : [];
    const source = asRecord(sources[0]);
    return {
      id: asText(raw.Id),
      name: asText(raw.Name) || "Untitled",
      kind: asText(raw.Type),
      year: asNumber(raw.ProductionYear),
      mediaSourceId: asText(source.Id),
    };
  }).filter((item) => item.id);
}

export function jellyfinImageUrl(baseUrl: string, itemId: string): string {
  const root = baseUrl.replace(/\/+$/, "");
  return `${root}/Items/${encodeURIComponent(itemId)}/Images/Primary?maxWidth=400`;
}

export function jellyfinAuthHeaders(token: string): Record<string, string> {
  return authHeaders(token);
}

export function jellyfinStreamUrl(baseUrl: string, item: JellyfinItem): string {
  const root = baseUrl.replace(/\/+$/, "");
  return `${root}${directStreamPath(item.id, item.mediaSourceId || undefined)}`;
}
