import { useEffect, useMemo } from "react";

import { useTrackedSeries } from "@/hooks/useTrackedSeries";
import { syncNotifications } from "@/lib/notifications";
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
    void syncNotifications(prefs, watchlist, upcoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by episodeSignature
  }, [prefs, watchlist, episodeSignature]);
}
