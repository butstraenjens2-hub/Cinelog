/**
 * SIMKL AUTH v2 device flow and library sync.
 * The viewer supplies their own client id. CineLog does not ship one.
 */

import { asRecord, asText, ownFetch } from "@/lib/own-server/http";
import { simklTitle } from "@/lib/simkl/map.mjs";

const APP = "CineLog";
const VERSION = "1.0.42";

export interface SimklDevice {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
}

export interface SimklTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function query(clientId: string): Record<string, string> {
  return { client_id: clientId, "app-name": APP, "app-version": VERSION };
}

function authHeaders(clientId: string, accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "simkl-api-key": clientId,
  };
}

export async function startSimklDevice(clientId: string): Promise<SimklDevice> {
  const raw = await ownFetch<Record<string, unknown>>("https://api.simkl.com", "/oauth2/device", {
    method: "POST",
    form: { client_id: clientId.trim(), scope: "media:read media:write" },
  });
  const deviceCode = asText(raw.device_code);
  const userCode = asText(raw.user_code);
  if (!deviceCode || !userCode) throw new Error("SIMKL did not return a device code.");
  return {
    deviceCode,
    userCode,
    verificationUrl: asText(raw.verification_uri_complete) || asText(raw.verification_uri) || "https://simkl.com/pin",
    expiresIn: Number(raw.expires_in) || 900,
    interval: Number(raw.interval) || 5,
  };
}

export async function pollSimklDevice(clientId: string, deviceCode: string): Promise<SimklTokens | "pending"> {
  try {
    const raw = await ownFetch<Record<string, unknown>>("https://api.simkl.com", "/oauth2/token", {
      method: "POST",
      form: {
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        client_id: clientId.trim(),
        device_code: deviceCode,
      },
    });
    return tokensFrom(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/authorization_pending|slow_down|pending/i.test(message)) return "pending";
    throw error;
  }
}

export async function refreshSimkl(clientId: string, refreshToken: string): Promise<SimklTokens> {
  const raw = await ownFetch<Record<string, unknown>>("https://api.simkl.com", "/oauth2/token", {
    method: "POST",
    form: {
      grant_type: "refresh_token",
      client_id: clientId.trim(),
      refresh_token: refreshToken,
    },
  });
  return tokensFrom(raw);
}

function tokensFrom(raw: Record<string, unknown>): SimklTokens {
  const accessToken = asText(raw.access_token);
  if (!accessToken) throw new Error("SIMKL did not return an access token.");
  return {
    accessToken,
    refreshToken: asText(raw.refresh_token),
    expiresIn: Number(raw.expires_in) || 7 * 24 * 60 * 60,
  };
}

export interface SimklLibraryItem {
  tmdbId: number;
  title: string;
  year: number | null;
  status: string;
  type: "movie" | "series";
  rating: number;
  episodes: Array<{ season: number; episode: number }>;
}

export async function fetchSimklLibrary(clientId: string, accessToken: string): Promise<SimklLibraryItem[]> {
  const headers = authHeaders(clientId, accessToken);
  const [movies, shows] = await Promise.all([
    ownFetch<unknown>("https://api.simkl.com", "/sync/all-items/movies", {
      headers,
      query: { ...query(clientId) },
    }),
    ownFetch<unknown>("https://api.simkl.com", "/sync/all-items/shows", {
      headers,
      query: { ...query(clientId), extended: "full" },
    }),
  ]);
  return [...readRows(movies, "movie", "movies"), ...readRows(shows, "series", "shows")];
}

function readRows(payload: unknown, type: "movie" | "series", key: string): SimklLibraryItem[] {
  const list = Array.isArray(payload) ? payload : asRecord(payload)[key];
  if (!Array.isArray(list)) return [];
  return list.map((row) => {
    const parsed = simklTitle(row);
    const raw = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const nested = asRecord(raw.movie ?? raw.show);
    return {
      tmdbId: parsed.tmdbId,
      title: parsed.title,
      year: parsed.year,
      status: parsed.status,
      type,
      rating: Number(raw.user_rating ?? nested.user_rating ?? raw.rating) || 0,
      episodes: episodePairs(parsed.seasons),
    };
  });
}

function episodePairs(seasons: unknown[]): Array<{ season: number; episode: number }> {
  const pairs: Array<{ season: number; episode: number }> = [];
  for (const season of seasons) {
    const raw = asRecord(season);
    const number = Number(raw.number ?? raw.season);
    const episodes = Array.isArray(raw.episodes) ? raw.episodes : [];
    for (const episode of episodes) {
      const item = asRecord(episode);
      const episodeNumber = Number(item.number ?? item.episode);
      if (number > 0 && episodeNumber > 0) pairs.push({ season: number, episode: episodeNumber });
    }
  }
  return pairs;
}

export async function pushSimklWatchlist(
  clientId: string,
  accessToken: string,
  movies: number[],
  shows: number[],
): Promise<void> {
  await ownFetch("https://api.simkl.com", "/sync/add-to-list", {
    method: "POST",
    headers: authHeaders(clientId, accessToken),
    query: query(clientId),
    body: {
      to: "plantowatch",
      movies: movies.map((tmdb) => ({ ids: { tmdb } })),
      shows: shows.map((tmdb) => ({ ids: { tmdb } })),
    },
  });
}

export async function pushSimklHistory(
  clientId: string,
  accessToken: string,
  movies: number[],
  shows: Array<{ tmdbId: number; episodes: Array<{ season: number; episode: number }> }>,
): Promise<void> {
  await ownFetch("https://api.simkl.com", "/sync/history", {
    method: "POST",
    headers: authHeaders(clientId, accessToken),
    query: query(clientId),
    body: {
      movies: movies.map((tmdb) => ({ ids: { tmdb } })),
      shows: shows.map((show) => ({
        ids: { tmdb: show.tmdbId },
        seasons: groupEpisodes(show.episodes),
      })),
    },
  });
}

export async function pushSimklRatings(
  clientId: string,
  accessToken: string,
  movies: Array<{ tmdbId: number; rating: number }>,
  shows: Array<{ tmdbId: number; rating: number }>,
): Promise<void> {
  await ownFetch("https://api.simkl.com", "/sync/ratings", {
    method: "POST",
    headers: authHeaders(clientId, accessToken),
    query: query(clientId),
    body: {
      movies: movies.map((item) => ({ rating: item.rating, ids: { tmdb: item.tmdbId } })),
      shows: shows.map((item) => ({ rating: item.rating, ids: { tmdb: item.tmdbId } })),
    },
  });
}

function groupEpisodes(episodes: Array<{ season: number; episode: number }>) {
  const seasons = new Map<number, number[]>();
  for (const episode of episodes) {
    const list = seasons.get(episode.season) ?? [];
    list.push(episode.episode);
    seasons.set(episode.season, list);
  }
  return [...seasons.entries()].map(([number, numbers]) => ({
    number,
    episodes: numbers.map((episode) => ({ number: episode })),
  }));
}
