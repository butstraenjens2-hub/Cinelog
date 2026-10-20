import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { Image } from "expo-image";

import { fetchMovieDetail, fetchSeriesDetail } from "@/lib/cinelog/api";
import { sizedTmdbImage } from "@/lib/cinelog/images";
import { mediaKeys } from "@/lib/cinelog/queries";
import { OFFLINE_GC_TIME, queryClient, STALE } from "@/lib/query-client";
import type { WatchlistItem } from "@/lib/cinelog/types";
import { useLibrary } from "@/store/library-store";
import { useOffline } from "@/store/offline-store";

/** Re-download offline copies after this long so they don't go stale. */
const REFRESH_AFTER = 3 * 24 * 60 * 60 * 1000;
const MAX_OFFLINE_TITLES = 60;
const START_DELAY_MS = 6000;

async function makeAvailableOffline(item: WatchlistItem): Promise<boolean> {
  const detail =
    item.type === "movie"
      ? await queryClient.fetchQuery({
          queryKey: mediaKeys.movieDetail(item.tmdbId),
          queryFn: () => fetchMovieDetail(item.tmdbId),
          staleTime: STALE.long,
          gcTime: OFFLINE_GC_TIME,
        })
      : await queryClient.fetchQuery({
          queryKey: mediaKeys.seriesDetail(item.tmdbId),
          queryFn: () => fetchSeriesDetail(item.tmdbId),
          staleTime: STALE.long,
          gcTime: OFFLINE_GC_TIME,
        });
  const artwork = [
    sizedTmdbImage(item.poster, 180),
    sizedTmdbImage(detail.title.poster, 180),
    sizedTmdbImage(detail.title.backdrop, 400, "still"),
  ].filter((url): url is string => Boolean(url));
  if (artwork.length === 0) return true;
  return Image.prefetch([...new Set(artwork)], "disk");
}

/**
 * Keeps watchlist titles readable offline: detail payloads stay in the
 * persisted query cache and posters/backdrops are prefetched to disk. Runs in
 * the background shortly after start-up and whenever the watchlist changes.
 */
export function useOfflineWatchlist(): void {
  const watchlist = useLibrary((state) => state.watchlist);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;
    const { retain } = useOffline.getState();
    retain(watchlist.map((item) => item.id));

    const run = async () => {
      const now = Date.now();
      const todo = watchlist.slice(0, MAX_OFFLINE_TITLES).filter((item) => {
        const at = Date.parse(useOffline.getState().ready[item.id] ?? "");
        return !Number.isFinite(at) || now - at > REFRESH_AFTER;
      });
      for (const item of todo) {
        if (cancelled || AppState.currentState !== "active") return;
        try {
          if (await makeAvailableOffline(item)) {
            useOffline.getState().markReady(item.id);
          }
        } catch {
          // Offline or API error: try again next time.
        }
      }
    };

    const timer = setTimeout(() => void run(), START_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [watchlist]);
}
