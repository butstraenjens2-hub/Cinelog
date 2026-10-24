/**
 * After the viewer opts in, push local watchlist and progress changes to Trakt.
 * Pulls stay manual so a remote list cannot wipe device-only titles.
 */

import { useEffect, useRef } from "react";

import { readSecret, SECRET } from "@/lib/secrets";
import { pushLocalProgress, pushLocalWatchlist } from "@/lib/trakt/sync";
import { useIntegrations } from "@/store/integrations-store";
import { useLibrary } from "@/store/library-store";

export function useTraktAutoSync(): void {
  const syncWatchlist = useIntegrations((state) => state.traktSyncWatchlist);
  const syncProgress = useIntegrations((state) => state.traktSyncProgress);
  const clientId = useIntegrations((state) => state.traktClientId);
  const watchlist = useLibrary((state) => state.watchlist);
  const episodes = useLibrary((state) => state.episodes);
  const history = useLibrary((state) => state.history);
  const ready = useRef(false);

  useEffect(() => {
    if (!clientId || (!syncWatchlist && !syncProgress)) return;
    if (!ready.current) {
      ready.current = true;
      return;
    }
    const timer = setTimeout(() => {
      void (async () => {
        const token = await readSecret(SECRET.traktAccessToken);
        if (!token) return;
        if (syncWatchlist) await pushLocalWatchlist().catch(() => undefined);
        if (syncProgress) await pushLocalProgress().catch(() => undefined);
      })();
    }, 2000);
    return () => clearTimeout(timer);
  }, [clientId, syncWatchlist, syncProgress, watchlist, episodes, history]);
}
