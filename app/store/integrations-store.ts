/**
 * Non-secret integration preferences. API keys and Trakt tokens stay in
 * `lib/secrets.ts` (device keystore), never in this persisted store.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface IntegrationsState {
  sonarrUrl: string;
  radarrUrl: string;
  traktClientId: string;
  traktExpiresAt: number;
  traktSyncWatchlist: boolean;
  traktSyncProgress: boolean;
  setSonarrUrl: (url: string) => void;
  setRadarrUrl: (url: string) => void;
  setTraktClientId: (id: string) => void;
  setTraktExpiresAt: (epochMs: number) => void;
  setTraktSyncWatchlist: (value: boolean) => void;
  setTraktSyncProgress: (value: boolean) => void;
}

export const useIntegrations = create<IntegrationsState>()(
  persist(
    (set) => ({
      sonarrUrl: "",
      radarrUrl: "",
      traktClientId: "",
      traktExpiresAt: 0,
      traktSyncWatchlist: false,
      traktSyncProgress: false,
      setSonarrUrl: (sonarrUrl) => set({ sonarrUrl: sonarrUrl.trim() }),
      setRadarrUrl: (radarrUrl) => set({ radarrUrl: radarrUrl.trim() }),
      setTraktClientId: (traktClientId) => set({ traktClientId: traktClientId.trim() }),
      setTraktExpiresAt: (traktExpiresAt) => set({ traktExpiresAt }),
      setTraktSyncWatchlist: (traktSyncWatchlist) => set({ traktSyncWatchlist }),
      setTraktSyncProgress: (traktSyncProgress) => set({ traktSyncProgress }),
    }),
    {
      name: "cinelog.integrations.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
