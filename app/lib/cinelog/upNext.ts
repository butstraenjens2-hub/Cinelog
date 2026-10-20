/**
 * CineLog — "Up next" and new-episode logic for tracked series.
 *
 * Pure functions so they can be unit-tested and shared between the home rail
 * and the notification scheduler.
 */

import type {
  EpisodeWatchMap,
  LibraryEntryRef,
  Series,
  WatchHistoryItem,
  WatchlistItem,
} from "@/lib/cinelog/types";

export interface UpNextEntry {
  series: LibraryEntryRef;
  seasonNumber: number;
  episodeNumber: number;
  /** Episodes left in the show after this one (aired ones only, best effort). */
  remaining: number;
}

export interface UpcomingEpisode {
  series: LibraryEntryRef;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string;
}

const EPISODE_KEY_RE = /^s(\d+)e(\d+)$/;

/** Latest watched (season, episode) pair, or null when nothing is ticked. */
export function lastWatched(
  map: EpisodeWatchMap | undefined,
): { seasonNumber: number; episodeNumber: number } | null {
  let best: { seasonNumber: number; episodeNumber: number } | null = null;
  for (const key of Object.keys(map ?? {})) {
    const match = EPISODE_KEY_RE.exec(key);
    if (!match) continue;
    const seasonNumber = Number(match[1]);
    const episodeNumber = Number(match[2]);
    if (
      !best ||
      seasonNumber > best.seasonNumber ||
      (seasonNumber === best.seasonNumber && episodeNumber > best.episodeNumber)
    ) {
      best = { seasonNumber, episodeNumber };
    }
  }
  return best;
}

/**
 * Series the viewer follows, most recent activity first: anything with ticked
 * episodes or a "watching" history entry, then saved (watchlist) shows.
 */
export function trackedSeries(
  history: WatchHistoryItem[],
  episodes: Record<string, EpisodeWatchMap>,
  watchlist: WatchlistItem[],
  limit = 12,
): LibraryEntryRef[] {
  const seen = new Set<string>();
  const out: LibraryEntryRef[] = [];
  const sorted = [...history].sort(
    (a, b) => Date.parse(b.watchedAt) - Date.parse(a.watchedAt),
  );
  for (const entry of sorted) {
    if (entry.type !== "series" || seen.has(entry.id)) continue;
    const hasEpisodes = Object.keys(episodes[entry.id] ?? {}).length > 0;
    if (!hasEpisodes && entry.state !== "watching") continue;
    seen.add(entry.id);
    out.push(entry);
  }
  for (const entry of watchlist) {
    if (entry.type !== "series" || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out.slice(0, limit);
}

function isAired(airDate: string | null | undefined, now: number): boolean {
  if (!airDate) return true;
  const at = Date.parse(airDate);
  return !Number.isFinite(at) || at <= now;
}

/** Next unwatched, already-aired episode after the last ticked one. */
export function nextEpisodeFor(
  ref: LibraryEntryRef,
  detail: Series,
  map: EpisodeWatchMap | undefined,
  now = Date.now(),
): UpNextEntry | null {
  const last = lastWatched(map);
  if (!last) return null;
  const seasons = detail.seasons.filter((s) => s.episodeCount > 0);
  const current = seasons.find((s) => s.seasonNumber === last.seasonNumber);
  let candidate: { seasonNumber: number; episodeNumber: number } | null = null;
  if (current && last.episodeNumber < current.episodeCount) {
    candidate = {
      seasonNumber: last.seasonNumber,
      episodeNumber: last.episodeNumber + 1,
    };
  } else {
    const following = seasons.find((s) => s.seasonNumber > last.seasonNumber);
    if (following && isAired(following.airDate, now)) {
      candidate = { seasonNumber: following.seasonNumber, episodeNumber: 1 };
    }
  }
  if (!candidate) return null;
  if (map?.[`s${candidate.seasonNumber}e${candidate.episodeNumber}`]) return null;

  // TMDB counts announced episodes too; never offer one that hasn't aired.
  const next = detail.nextEpisode;
  if (
    next &&
    !isAired(next.airDate, now) &&
    (candidate.seasonNumber > next.seasonNumber ||
      (candidate.seasonNumber === next.seasonNumber &&
        candidate.episodeNumber >= next.episodeNumber))
  ) {
    return null;
  }

  const remaining = seasons
    .filter((s) => s.seasonNumber >= candidate!.seasonNumber)
    .reduce(
      (sum, s) =>
        sum +
        (s.seasonNumber === candidate!.seasonNumber
          ? s.episodeCount - candidate!.episodeNumber
          : s.episodeCount),
      0,
    );

  return { series: ref, ...candidate, remaining: Math.max(0, remaining) };
}

/** Future episode announced by TMDB for a tracked series, if any. */
export function upcomingEpisodeFor(
  ref: LibraryEntryRef,
  detail: Series,
  now = Date.now(),
): UpcomingEpisode | null {
  const next = detail.nextEpisode;
  if (!next?.airDate || isAired(next.airDate, now)) return null;
  return {
    series: ref,
    seasonNumber: next.seasonNumber,
    episodeNumber: next.episodeNumber,
    name: next.name,
    airDate: next.airDate,
  };
}

/** "S02 E05" */
export function episodeCode(seasonNumber: number, episodeNumber: number): string {
  return `S${String(seasonNumber).padStart(2, "0")} E${String(episodeNumber).padStart(2, "0")}`;
}
