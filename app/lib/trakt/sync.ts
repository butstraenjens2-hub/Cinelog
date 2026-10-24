/**
 * Push and pull the local library against the viewer's Trakt account.
 * Pulls only add missing items. They do not delete anything saved only on device.
 */

import {
  fetchTraktPlayback,
  fetchTraktWatched,
  fetchTraktWatchlist,
  pushTraktProgress,
  pushTraktWatchlist,
  type TraktTitleRef,
} from "@/lib/trakt/api";
import type { LibraryEntryRef } from "@/lib/cinelog/types";
import { useLibrary } from "@/store/library-store";

function refFor(type: "movie" | "series", item: TraktTitleRef): LibraryEntryRef {
  return {
    id: `${type}:${item.tmdbId}`,
    tmdbId: item.tmdbId,
    type,
    title: item.title || (type === "movie" ? "Movie" : "Series"),
    poster: null,
    backdrop: null,
    year: item.year,
    rating: 0,
    genres: [],
    genreIds: [],
    releaseDate: null,
  };
}

export async function pullTraktWatchlist(): Promise<number> {
  const remote = await fetchTraktWatchlist();
  const library = useLibrary.getState();
  let added = 0;
  for (const movie of remote.movies) {
    const ref = refFor("movie", movie);
    if (library.isInWatchlist(ref.id)) continue;
    library.toggleWatchlist(ref);
    added += 1;
  }
  for (const show of remote.shows) {
    const ref = refFor("series", show);
    if (useLibrary.getState().isInWatchlist(ref.id)) continue;
    useLibrary.getState().toggleWatchlist(ref);
    added += 1;
  }
  return added;
}

export async function pushLocalWatchlist(): Promise<void> {
  const watchlist = useLibrary.getState().watchlist;
  await pushTraktWatchlist({
    movies: watchlist.filter((item) => item.type === "movie").map((item) => item.tmdbId),
    shows: watchlist.filter((item) => item.type === "series").map((item) => item.tmdbId),
  });
}

export async function pullTraktProgress(): Promise<number> {
  const remote = await fetchTraktWatched();
  const library = useLibrary.getState();
  let applied = 0;
  for (const movie of remote.movies) {
    const ref = refFor("movie", movie);
    if (library.getWatchState(ref.id) === "watched") continue;
    library.setWatchState(ref, "watched");
    applied += 1;
  }
  for (const show of remote.shows) {
    const ref = refFor("series", show.show);
    for (const episode of show.episodes) {
      if (library.isEpisodeWatched(ref.id, episode.season, episode.episode)) continue;
      library.toggleEpisodeWatched(ref, episode.season, episode.episode);
      applied += 1;
    }
  }
  return applied;
}

export async function pushLocalProgress(): Promise<void> {
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
        return match
          ? { season: Number(match[1]), episode: Number(match[2]) }
          : null;
      })
      .filter((item): item is { season: number; episode: number } => item !== null);
    return watched.length ? [{ tmdbId, episodes: watched }] : [];
  });
  await pushTraktProgress({ movies, shows });
}

export async function pullTraktPlaybackPositions(): Promise<number> {
  const rows = await fetchTraktPlayback();
  const library = useLibrary.getState();
  let applied = 0;
  for (const row of rows) {
    if (row.type === "movie" && row.movie) {
      const ref = refFor("movie", row.movie);
      library.saveProgress(ref, { percent: row.progress });
      applied += 1;
    } else if (row.type === "episode" && row.show && row.season && row.episode) {
      const ref = refFor("series", row.show);
      library.saveProgress(ref, {
        percent: row.progress,
        seasonNumber: row.season,
        episodeNumber: row.episode,
        episodeTitle: row.episodeTitle,
      });
      applied += 1;
    }
  }
  return applied;
}
