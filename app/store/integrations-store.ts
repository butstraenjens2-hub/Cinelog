/**
 * Non-secret integration preferences. API keys and tokens stay in
 * `lib/secrets.ts` (device keystore), never in this persisted store.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type LibraryServerKind = "jellyfin" | "emby";

export interface IntegrationsState {
  sonarrUrl: string;
  radarrUrl: string;
  traktClientId: string;
  traktExpiresAt: number;
  traktSyncWatchlist: boolean;
  traktSyncProgress: boolean;
  jellyfinUrl: string;
  jellyfinUserId: string;
  jellyfinServerName: string;
  libraryServerKind: LibraryServerKind;
  seerrUrl: string;
  tautulliUrl: string;
  kodiUrl: string;
  kodiUsername: string;
  simklClientId: string;
  simklExpiresAt: number;
  setSonarrUrl: (url: string) => void;
  setRadarrUrl: (url: string) => void;
  setTraktClientId: (id: string) => void;
  setTraktExpiresAt: (epochMs: number) => void;
  setTraktSyncWatchlist: (value: boolean) => void;
  setTraktSyncProgress: (value: boolean) => void;
  setJellyfinUrl: (url: string) => void;
  setJellyfinUserId: (id: string) => void;
  setJellyfinServerName: (name: string) => void;
  setLibraryServerKind: (kind: LibraryServerKind) => void;
  setSeerrUrl: (url: string) => void;
  setTautulliUrl: (url: string) => void;
  setKodiUrl: (url: string) => void;
  setKodiUsername: (name: string) => void;
  setSimklClientId: (id: string) => void;
  setSimklExpiresAt: (epochMs: number) => void;
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
      jellyfinUrl: "",
      jellyfinUserId: "",
      jellyfinServerName: "",
      libraryServerKind: "jellyfin",
      seerrUrl: "",
      tautulliUrl: "",
      kodiUrl: "",
      kodiUsername: "",
      simklClientId: "",
      simklExpiresAt: 0,
      setSonarrUrl: (sonarrUrl) => set({ sonarrUrl: sonarrUrl.trim() }),
      setRadarrUrl: (radarrUrl) => set({ radarrUrl: radarrUrl.trim() }),
      setTraktClientId: (traktClientId) => set({ traktClientId: traktClientId.trim() }),
      setTraktExpiresAt: (traktExpiresAt) => set({ traktExpiresAt }),
      setTraktSyncWatchlist: (traktSyncWatchlist) => set({ traktSyncWatchlist }),
      setTraktSyncProgress: (traktSyncProgress) => set({ traktSyncProgress }),
      setJellyfinUrl: (jellyfinUrl) => set({ jellyfinUrl: jellyfinUrl.trim() }),
      setJellyfinUserId: (jellyfinUserId) => set({ jellyfinUserId }),
      setJellyfinServerName: (jellyfinServerName) => set({ jellyfinServerName }),
      setLibraryServerKind: (libraryServerKind) => set({ libraryServerKind }),
      setSeerrUrl: (seerrUrl) => set({ seerrUrl: seerrUrl.trim() }),
      setTautulliUrl: (tautulliUrl) => set({ tautulliUrl: tautulliUrl.trim() }),
      setKodiUrl: (kodiUrl) => set({ kodiUrl: kodiUrl.trim() }),
      setKodiUsername: (kodiUsername) => set({ kodiUsername: kodiUsername.trim() }),
      setSimklClientId: (simklClientId) => set({ simklClientId: simklClientId.trim() }),
      setSimklExpiresAt: (simklExpiresAt) => set({ simklExpiresAt }),
    }),
    {
      name: "cinelog.integrations.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
