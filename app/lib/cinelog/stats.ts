/**
 * CineLog — viewing statistics and "year in review".
 *
 * Built purely from the local library: finished movies come from the watch
 * history, episodes from the per-episode ticks (each with its own timestamp).
 */

import type {
  EpisodeWatchMap,
  MediaId,
  UserRating,
  WatchHistoryItem,
} from "@/lib/cinelog/types";

const ASSUMED_MOVIE_RUNTIME = 110;
const ASSUMED_EPISODE_RUNTIME = 45;
const DAY = 24 * 60 * 60 * 1000;

export interface YearInReview {
  year: number;
  movies: number;
  episodes: number;
  series: number;
  hours: number;
  /** Activity count per month, January first. */
  months: number[];
  busiestMonth: number | null;
  topGenres: { name: string; count: number }[];
  ratingsGiven: number;
  averageRating: number | null;
  favouriteTitle: UserRating | null;
}

export interface StreakStats {
  current: number;
  longest: number;
}

interface Activity {
  at: number;
  kind: "movie" | "episode";
  id: MediaId;
  genres: string[];
  minutes: number;
}

function activities(
  history: WatchHistoryItem[],
  episodes: Record<MediaId, EpisodeWatchMap>,
): Activity[] {
  const genresById = new Map<MediaId, string[]>();
  for (const entry of history) genresById.set(entry.id, entry.genres ?? []);

  const out: Activity[] = [];
  for (const entry of history) {
    if (entry.type !== "movie" || entry.state !== "watched") continue;
    const at = Date.parse(entry.watchedAt);
    if (!Number.isFinite(at)) continue;
    out.push({
      at,
      kind: "movie",
      id: entry.id,
      genres: entry.genres ?? [],
      minutes: entry.runtime || entry.minutes || ASSUMED_MOVIE_RUNTIME,
    });
  }
  for (const [id, map] of Object.entries(episodes)) {
    for (const stamp of Object.values(map ?? {})) {
      const at = Date.parse(stamp);
      if (!Number.isFinite(at)) continue;
      out.push({
        at,
        kind: "episode",
        id,
        genres: genresById.get(id) ?? [],
        minutes: ASSUMED_EPISODE_RUNTIME,
      });
    }
  }
  return out;
}

/** Years with any activity, newest first (always includes the current year). */
export function activeYears(
  history: WatchHistoryItem[],
  episodes: Record<MediaId, EpisodeWatchMap>,
  now = new Date(),
): number[] {
  const years = new Set<number>([now.getFullYear()]);
  for (const a of activities(history, episodes)) years.add(new Date(a.at).getFullYear());
  return [...years].sort((a, b) => b - a);
}

export function yearInReview(
  year: number,
  history: WatchHistoryItem[],
  episodes: Record<MediaId, EpisodeWatchMap>,
  ratings: Record<MediaId, UserRating>,
): YearInReview {
  const items = activities(history, episodes).filter(
    (a) => new Date(a.at).getFullYear() === year,
  );
  const months = Array.from({ length: 12 }, () => 0);
  const genreCounts = new Map<string, number>();
  const series = new Set<MediaId>();
  let minutes = 0;
  let movies = 0;
  let episodeCount = 0;
  for (const a of items) {
    months[new Date(a.at).getMonth()] += 1;
    minutes += a.minutes;
    if (a.kind === "movie") movies += 1;
    else {
      episodeCount += 1;
      series.add(a.id);
    }
    for (const genre of a.genres) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
  }
  const peak = Math.max(...months);
  const yearRatings = Object.values(ratings).filter(
    (r) => new Date(Date.parse(r.ratedAt)).getFullYear() === year,
  );
  const favouriteTitle =
    [...yearRatings].sort(
      (a, b) => b.score - a.score || Date.parse(b.ratedAt) - Date.parse(a.ratedAt),
    )[0] ?? null;

  return {
    year,
    movies,
    episodes: episodeCount,
    series: series.size,
    hours: Math.round(minutes / 60),
    months,
    busiestMonth: peak > 0 ? months.indexOf(peak) : null,
    topGenres: [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count })),
    ratingsGiven: yearRatings.length,
    averageRating: yearRatings.length
      ? Math.round(
          (yearRatings.reduce((sum, r) => sum + r.score, 0) / yearRatings.length) * 10,
        ) / 10
      : null,
    favouriteTitle,
  };
}

/** Consecutive days with at least one movie or episode watched. */
export function watchStreak(
  history: WatchHistoryItem[],
  episodes: Record<MediaId, EpisodeWatchMap>,
  now = Date.now(),
): StreakStats {
  const days = new Set<number>();
  for (const a of activities(history, episodes)) {
    const d = new Date(a.at);
    days.add(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
  }
  const sorted = [...days].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const day of sorted) {
    run = previous !== null && Math.round((day - previous) / DAY) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  const today = new Date(now);
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  // A streak is still alive if the last activity was today or yesterday.
  if (!days.has(cursor)) cursor -= DAY;
  let current = 0;
  while (days.has(cursor)) {
    current += 1;
    cursor -= DAY;
  }
  return { current, longest };
}
