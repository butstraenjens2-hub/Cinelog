/**
 * Trakt API v2. The viewer supplies their own application client id and secret
 * from https://trakt.tv/oauth/applications. CineLog does not ship a shared secret.
 */

import { readSecret, SECRET, writeSecret } from "@/lib/secrets";
import { useIntegrations } from "@/store/integrations-store";

const API = "https://api.trakt.tv";

export class TraktError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "TraktError";
    this.status = status;
  }
}

export interface TraktDeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  created_at?: number;
}

async function traktFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    clientId: string;
    token?: string;
  },
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "trakt-api-version": "2",
      "trakt-api-key": options.clientId,
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok) {
    throw new TraktError(
      response.status,
      payload.error_description || payload.error || `Trakt returned ${response.status}.`,
    );
  }
  return payload;
}

export async function startTraktDevice(
  clientId: string,
): Promise<TraktDeviceCode> {
  const payload = await traktFetch<{
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
  }>("/oauth/device/code", { method: "POST", body: { client_id: clientId }, clientId });
  return {
    deviceCode: payload.device_code,
    userCode: payload.user_code,
    verificationUrl: payload.verification_url,
    expiresIn: payload.expires_in,
    interval: payload.interval || 5,
  };
}

export async function pollTraktDevice(
  clientId: string,
  clientSecret: string,
  deviceCode: string,
): Promise<"pending" | "granted"> {
  try {
    const token = await traktFetch<TokenResponse>("/oauth/device/token", {
      method: "POST",
      clientId,
      body: { code: deviceCode, client_id: clientId, client_secret: clientSecret },
    });
    await storeToken(token);
    return "granted";
  } catch (error) {
    if (error instanceof TraktError && (error.status === 400 || error.status === 429)) {
      return "pending";
    }
    throw error;
  }
}

async function storeToken(token: TokenResponse): Promise<void> {
  if (!token.access_token) throw new TraktError(0, "Trakt did not return a token.");
  await writeSecret(SECRET.traktAccessToken, token.access_token);
  if (token.refresh_token) await writeSecret(SECRET.traktRefreshToken, token.refresh_token);
  const created = (token.created_at ?? Math.floor(Date.now() / 1000)) * 1000;
  const expiresIn = (token.expires_in ?? 7_776_000) * 1000;
  useIntegrations.getState().setTraktExpiresAt(created + expiresIn);
}

export async function traktAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const current = await readSecret(SECRET.traktAccessToken);
  const expiresAt = useIntegrations.getState().traktExpiresAt;
  if (current && expiresAt - Date.now() > 60_000) return current;
  const refresh = await readSecret(SECRET.traktRefreshToken);
  if (!refresh || !clientSecret) {
    if (current) return current;
    throw new TraktError(0, "Connect Trakt first.");
  }
  const token = await traktFetch<TokenResponse>("/oauth/token", {
    method: "POST",
    clientId,
    body: {
      refresh_token: refresh,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    },
  });
  await storeToken(token);
  return token.access_token ?? current;
}

export async function traktJson<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const clientId = useIntegrations.getState().traktClientId.trim();
  const clientSecret = await readSecret(SECRET.traktClientSecret);
  if (!clientId) throw new TraktError(0, "Add your Trakt client ID in Settings.");
  const token = await traktAccessToken(clientId, clientSecret);
  return traktFetch<T>(path, { ...options, clientId, token });
}

export interface TraktTitleRef {
  tmdbId: number;
  title: string;
  year: number;
}

function titleFrom(node: unknown): TraktTitleRef | null {
  if (!node || typeof node !== "object") return null;
  const raw = node as { title?: string; year?: number; ids?: { tmdb?: number } };
  const tmdbId = Number(raw.ids?.tmdb);
  if (!tmdbId) return null;
  return { tmdbId, title: raw.title || "", year: Number(raw.year) || 0 };
}

export async function fetchTraktWatchlist(): Promise<{
  movies: TraktTitleRef[];
  shows: TraktTitleRef[];
}> {
  const [movies, shows] = await Promise.all([
    traktJson<unknown[]>("/sync/watchlist/movies"),
    traktJson<unknown[]>("/sync/watchlist/shows"),
  ]);
  const map = (rows: unknown[], key: "movie" | "show") =>
    (Array.isArray(rows) ? rows : [])
      .map((row) => titleFrom((row as Record<string, unknown>)[key]))
      .filter((item): item is TraktTitleRef => item !== null);
  return { movies: map(movies, "movie"), shows: map(shows, "show") };
}

export interface TraktWatchedShow {
  show: TraktTitleRef;
  episodes: { season: number; episode: number }[];
}

export async function fetchTraktWatched(): Promise<{
  movies: TraktTitleRef[];
  shows: TraktWatchedShow[];
}> {
  const [movies, shows] = await Promise.all([
    traktJson<unknown[]>("/sync/watched/movies"),
    traktJson<unknown[]>("/sync/watched/shows"),
  ]);
  const movieRefs = (Array.isArray(movies) ? movies : [])
    .map((row) => titleFrom((row as Record<string, unknown>).movie))
    .filter((item): item is TraktTitleRef => item !== null);
  const showRefs: TraktWatchedShow[] = [];
  for (const row of Array.isArray(shows) ? shows : []) {
    const raw = row as {
      show?: unknown;
      seasons?: { number?: number; episodes?: { number?: number }[] }[];
    };
    const show = titleFrom(raw.show);
    if (!show) continue;
    const episodes: { season: number; episode: number }[] = [];
    for (const season of raw.seasons ?? []) {
      for (const episode of season.episodes ?? []) {
        if (season.number && episode.number) {
          episodes.push({ season: season.number, episode: episode.number });
        }
      }
    }
    showRefs.push({ show, episodes });
  }
  return { movies: movieRefs, shows: showRefs };
}

export interface TraktPlayback {
  type: "movie" | "episode";
  progress: number;
  movie?: TraktTitleRef;
  show?: TraktTitleRef;
  season?: number;
  episode?: number;
  episodeTitle?: string;
}

export async function fetchTraktPlayback(): Promise<TraktPlayback[]> {
  const rows = await traktJson<unknown[]>("/sync/playback");
  const out: TraktPlayback[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const raw = row as {
      type?: string;
      progress?: number;
      movie?: unknown;
      show?: unknown;
      episode?: { season?: number; number?: number; title?: string };
    };
    const progress = Number(raw.progress) || 0;
    if (raw.type === "movie") {
      const movie = titleFrom(raw.movie);
      if (movie) out.push({ type: "movie", progress, movie });
    } else if (raw.type === "episode") {
      const show = titleFrom(raw.show);
      if (show) {
        out.push({
          type: "episode",
          progress,
          show,
          season: raw.episode?.season,
          episode: raw.episode?.number,
          episodeTitle: raw.episode?.title,
        });
      }
    }
  }
  return out;
}

export async function pushTraktWatchlist(input: {
  movies: number[];
  shows: number[];
}): Promise<void> {
  await traktJson("/sync/watchlist", {
    method: "POST",
    body: {
      movies: input.movies.map((tmdb) => ({ ids: { tmdb } })),
      shows: input.shows.map((tmdb) => ({ ids: { tmdb } })),
    },
  });
}

export async function pushTraktProgress(input: {
  movies: number[];
  shows: { tmdbId: number; episodes: { season: number; episode: number }[] }[];
}): Promise<void> {
  await traktJson("/sync/history", {
    method: "POST",
    body: {
      movies: input.movies.map((tmdb) => ({ ids: { tmdb } })),
      shows: input.shows.map((show) => ({
        ids: { tmdb: show.tmdbId },
        seasons: groupEpisodes(show.episodes),
      })),
    },
  });
}

function groupEpisodes(episodes: { season: number; episode: number }[]) {
  const seasons = new Map<number, number[]>();
  for (const episode of episodes) {
    const list = seasons.get(episode.season) ?? [];
    list.push(episode.episode);
    seasons.set(episode.season, list);
  }
  return [...seasons.entries()].map(([number, episodeNumbers]) => ({
    number,
    episodes: episodeNumbers.map((episode) => ({ number: episode })),
  }));
}
