import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import { fetchSeriesDetail } from "@/lib/cinelog/api";
import { mediaKeys } from "@/lib/cinelog/queries";
import { STALE } from "@/lib/query-client";
import {
  nextEpisodeFor,
  trackedSeries,
  upcomingEpisodeFor,
  type UpNextEntry,
  type UpcomingEpisode,
} from "@/lib/cinelog/upNext";
import type { LibraryEntryRef, Series } from "@/lib/cinelog/types";
import { useLibrary } from "@/store/library-store";

export interface TrackedSeriesState {
  tracked: LibraryEntryRef[];
  upNext: UpNextEntry[];
  upcoming: UpcomingEpisode[];
  isLoading: boolean;
}

/**
 * Loads detail for the series the viewer follows (sharing the detail-page cache,
 * which is persisted) and derives the "Up next" rail and upcoming episodes.
 */
export function useTrackedSeries(enabled = true): TrackedSeriesState {
  const history = useLibrary((state) => state.history);
  const episodes = useLibrary((state) => state.episodes);
  const watchlist = useLibrary((state) => state.watchlist);

  const tracked = useMemo(
    () => trackedSeries(history, episodes, watchlist),
    [history, episodes, watchlist],
  );

  const details = useQueries({
    queries: tracked.map((ref) => ({
      queryKey: mediaKeys.seriesDetail(ref.tmdbId),
      queryFn: () => fetchSeriesDetail(ref.tmdbId),
      staleTime: STALE.long,
      enabled,
    })),
  });

  const detailData = details.map((query) => query.data);
  const isLoading = details.some((query) => query.isLoading);
  // useQueries returns a new array each render; key memoisation on the data.
  const dataKey = details.map((query) => query.dataUpdatedAt).join("|");

  return useMemo(() => {
    const upNext: UpNextEntry[] = [];
    const upcoming: UpcomingEpisode[] = [];
    tracked.forEach((ref, index) => {
      const series = detailData[index]?.title as Series | undefined;
      if (!series) return;
      const next = nextEpisodeFor(ref, series, episodes[ref.id]);
      if (next) upNext.push(next);
      const soon = upcomingEpisodeFor(ref, series);
      if (soon) upcoming.push(soon);
    });
    upcoming.sort((a, b) => Date.parse(a.airDate) - Date.parse(b.airDate));
    return { tracked, upNext, upcoming, isLoading };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- detailData is keyed by dataKey
  }, [tracked, episodes, dataKey, isLoading]);
}
