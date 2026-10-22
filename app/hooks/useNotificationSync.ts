import { useEffect, useMemo } from "react";
import { InteractionManager } from "react-native";

import { useTrackedSeries } from "@/hooks/useTrackedSeries";
import { episodeCode } from "@/lib/cinelog/upNext";
import { syncNotifications } from "@/lib/notifications";
import { publishWidgetSnapshot } from "@/lib/widget";
import { useLibrary } from "@/store/library-store";
import { useSettings } from "@/store/settings-store";

/**
 * Keep the scheduled reminder queue in step with the notification preferences
 * and the watchlist. Rebuilding is idempotent, so running it on every change is
 * cheaper than tracking which reminder belongs to which title.
 */
export function useNotificationSync(): void {
  const prefs = useSettings((state) => state.notifications);
  const watchlist = useLibrary((state) => state.watchlist);
  const { upcoming } = useTrackedSeries(prefs.newEpisodes !== false);

  // Only reschedule when the set of upcoming episodes actually changes, not on
  // every detail refetch.
  const episodeSignature = useMemo(
    () =>
      upcoming
        .map((e) => `${e.series.id}:${e.seasonNumber}:${e.episodeNumber}:${e.airDate}`)
        .join("|"),
    [upcoming],
  );

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void syncNotifications(prefs, watchlist, upcoming);
    });
    return () => task.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by episodeSignature
  }, [prefs, watchlist, episodeSignature]);

  useEffect(() => {
    const next = upcoming[0];
    const saved = watchlist[0];
    if (next) {
      publishWidgetSnapshot({
        title: next.series.title,
        subtitle: `${episodeCode(next.seasonNumber, next.episodeNumber)} · ${next.airDate}`,
        path: `/series/${next.series.tmdbId}`,
      });
      return;
    }
    if (saved) {
      publishWidgetSnapshot({
        title: saved.title,
        subtitle: "On your watchlist",
        path: saved.type === "movie" ? `/movie/${saved.tmdbId}` : `/series/${saved.tmdbId}`,
      });
      return;
    }
    publishWidgetSnapshot({
      title: "CineLog",
      subtitle: "Discover what to watch",
      path: "",
    });
  }, [episodeSignature, upcoming, watchlist]);
}
