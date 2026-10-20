import { useMemo } from "react";

import { useMovieDetail, useSeriesDetail } from "@/lib/cinelog/queries";
import type { MediaSummary, UserRating } from "@/lib/cinelog/types";
import { useLibrary } from "@/store/library-store";

/** Ratings at or above this count as "liked". */
const LIKED_SCORE = 8;

export interface BecauseYouLiked {
  seed: UserRating | null;
  items: MediaSummary[];
  isLoading: boolean;
}

/**
 * TMDB recommendations for the viewer's most recently rated favourite
 * (score ≥ 8), minus anything already watched, rated or saved.
 */
export function useBecauseYouLiked(enabled = true): BecauseYouLiked {
  const ratings = useLibrary((state) => state.ratings);
  const history = useLibrary((state) => state.history);
  const watchlist = useLibrary((state) => state.watchlist);

  const seed = useMemo(() => {
    const liked = Object.values(ratings)
      .filter((r) => r.score >= LIKED_SCORE)
      .sort((a, b) => b.score - a.score || Date.parse(b.ratedAt) - Date.parse(a.ratedAt));
    // Rotate daily between the top few so the rail doesn't go stale.
    const pool = liked.slice(0, 5);
    if (pool.length === 0) return null;
    const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    return pool[day % pool.length];
  }, [ratings]);

  const movie = useMovieDetail(enabled && seed?.type === "movie" ? seed.tmdbId : null);
  const series = useSeriesDetail(enabled && seed?.type === "series" ? seed.tmdbId : null);
  const detail = seed?.type === "movie" ? movie.data : series.data;
  const isLoading = seed?.type === "movie" ? movie.isLoading : series.isLoading;

  const items = useMemo(() => {
    if (!detail) return [];
    const seen = new Set<string>([
      ...Object.keys(ratings),
      ...history.map((h) => h.id),
      ...watchlist.map((w) => w.id),
    ]);
    const pool = detail.recommendations.length ? detail.recommendations : detail.similar;
    return pool.filter((item) => item.poster && !seen.has(item.id)).slice(0, 20);
  }, [detail, ratings, history, watchlist]);

  return { seed, items, isLoading: Boolean(seed) && isLoading };
}
