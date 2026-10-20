/**
 * CineLog — which watchlist titles are available offline (detail cached +
 * artwork on disk). Purely a local bookkeeping store for the badge.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { MediaId } from "@/lib/cinelog/types";

interface OfflineState {
  /** Media id → ISO time the title was last made available offline. */
  ready: Record<MediaId, string>;
  markReady: (id: MediaId) => void;
  /** Forget titles that left the watchlist. */
  retain: (ids: MediaId[]) => void;
}

export const useOffline = create<OfflineState>()(
  persist(
    (set) => ({
      ready: {},
      markReady: (id) =>
        set((state) => ({ ready: { ...state.ready, [id]: new Date().toISOString() } })),
      retain: (ids) =>
        set((state) => {
          const keep = new Set(ids);
          const next: Record<MediaId, string> = {};
          for (const [id, at] of Object.entries(state.ready)) if (keep.has(id)) next[id] = at;
          return Object.keys(next).length === Object.keys(state.ready).length
            ? state
            : { ready: next };
        }),
    }),
    {
      name: "cinelog.offline.v1",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
