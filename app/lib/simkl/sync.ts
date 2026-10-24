/**
 * Pull and push the local library against the viewer's SIMKL account.
 * Pulls only add missing items.
 */

import type { LibraryEntryRef } from "@/lib/cinelog/types";
import {
  fetchSimklLibrary,
  pushSimklHistory,
  pushSimklRatings,
  pushSimklWatchlist,
  type SimklLibraryItem,
} from "@/lib/simkl/api";
import { simklBucket } from "@/lib/simkl/map.mjs";
import { readSecret, SECRET, writeSecret } from "@/lib/secrets";
import { refreshSimkl } from "@/lib/simkl/api";
import { useIntegrations } from "@/store/integrations-store";
import { useLibrary } from "@/store/library-store";

function refFor(type: "movie" | "series", item: SimklLibraryItem): LibraryEntryRef | null {
  if (!item.tmdbId) return null;
  return {
    id: `${type}:${item.tmdbId}`,
    tmdbId: item.tmdbId,
    type,
    title: item.title || (type === "movie" ? "Movie" : "Series"),
    poster: null,
    backdrop: null,
    year: item.year ?? 0,
    rating: 0,
    genres: [],
    genreIds: [],
    releaseDate: null,
  };
}

export async function simklAccessToken(): Promise<{ clientId: string; token: string }> {
  const { simklClientId, simklExpiresAt, setSimklExpiresAt } = useIntegrations.getState();
  const clientId = simklClientId.trim();
  if (!clientId) throw new Error("Add your SIMKL client ID first.");
  let token = await readSecret(SECRET.simklAccessToken);
  if (!token) throw new Error("Connect SIMKL first.");
  if (simklExpiresAt && simklExpiresAt < Date.now() + 60_000) {
    const refresh = await readSecret(SECRET.simklRefreshToken);
    if (!refresh) return { clientId, token };
    const next = await refreshSimkl(clientId, refresh);
    token = next.accessToken;
    await writeSecret(SECRET.simklAccessToken, next.accessToken);
    if (next.refreshToken) await writeSecret(SECRET.simklRefreshToken, next.refreshToken);
    setSimklExpiresAt(Date.now() + next.expiresIn * 1000);
  }
  return { clientId, token };
}

export async function pullSimklLibrary(): Promise<{ watchlist: number; progress: number }> {
  const { clientId, token } = await simklAccessToken();
  const remote = await fetchSimklLibrary(clientId, token);
  let watchlist = 0;
  let progress = 0;
  for (const item of remote) {
    const bucket = simklBucket(item.status);
    const ref = refFor(item.type, item);
    if (!bucket || !ref) continue;
    const library = useLibrary.getState();
    if (item.rating >= 1 && item.rating <= 10 && !library.getRating(ref.id)) {
      library.rate(ref, item.rating);
    }
    if (bucket === "watchlist") {
      if (library.isInWatchlist(ref.id)) continue;
      library.toggleWatchlist(ref);
      watchlist += 1;
      continue;
    }
    if (item.type === "movie") {
      if (item.status !== "completed") continue;
      if (library.getWatchState(ref.id) === "watched") continue;
      library.setWatchState(ref, "watched");
      progress += 1;
      continue;
    }
    if (item.episodes.length) {
      for (const episode of item.episodes) {
        if (useLibrary.getState().isEpisodeWatched(ref.id, episode.season, episode.episode)) continue;
        useLibrary.getState().toggleEpisodeWatched(ref, episode.season, episode.episode);
        progress += 1;
      }
    }
    if (item.status === "watching" && library.getWatchState(ref.id) !== "watched") {
      library.setWatchState(ref, "watching");
      if (!useLibrary.getState().isInWatchlist(ref.id)) useLibrary.getState().toggleWatchlist(ref);
      progress += 1;
      continue;
    }
    if (item.status === "completed" && !item.episodes.length && library.getWatchState(ref.id) !== "watched") {
      library.setWatchState(ref, "watched");
      progress += 1;
    }
  }
  return { watchlist, progress };
}

export async function pushSimklRatingsFromDevice(): Promise<void> {
  const { clientId, token } = await simklAccessToken();
  const ratings = Object.values(useLibrary.getState().ratings);
  await pushSimklRatings(
    clientId,
    token,
    ratings.filter((item) => item.type === "movie").map((item) => ({ tmdbId: item.tmdbId, rating: item.score })),
    ratings.filter((item) => item.type === "series").map((item) => ({ tmdbId: item.tmdbId, rating: item.score })),
  );
}

export async function pushSimklWatchlistFromDevice(): Promise<void> {
  const { clientId, token } = await simklAccessToken();
  const watchlist = useLibrary.getState().watchlist;
  await pushSimklWatchlist(
    clientId,
    token,
    watchlist.filter((item) => item.type === "movie").map((item) => item.tmdbId),
    watchlist.filter((item) => item.type === "series").map((item) => item.tmdbId),
  );
}

export async function pushSimklProgressFromDevice(): Promise<void> {
  const { clientId, token } = await simklAccessToken();
  const { history, episodes } = useLibrary.getState();
  const movies = history
    .filter((item) => item.type === "movie" && item.state === "watched")
    .map((item) => item.tmdbId);
  const shows = Object.entries(episodes).flatMap(([id, map]) => {
    if (!id.startsWith("series:")) return [];
    const tmdbId = Number(id.slice("series:".length));
    if (!tmdbId) return [];
    const watched = Object.keys(map)
      .map((key) => {
        const match = /^s(\d+)e(\d+)$/.exec(key);
        return match ? { season: Number(match[1]), episode: Number(match[2]) } : null;
      })
      .filter((item): item is { season: number; episode: number } => item !== null);
    return watched.length ? [{ tmdbId, episodes: watched }] : [];
  });
  await pushSimklHistory(clientId, token, movies, shows);
}
