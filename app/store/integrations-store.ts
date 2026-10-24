/**
 * Non-secret integration preferences. API keys and tokens stay in
 * `lib/secrets.ts` (device keystore), never in this persisted store.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type LibraryServerKind = "jellyfin" | "emby";

export interface IntegrationsState {
  radarrUrl: string;
  jellyfinUrl: string;
  jellyfinUserId: string;
  jellyfinServerName: string;
  libraryServerKind: LibraryServerKind;
  setRadarrUrl: (url: string) => void;
  setJellyfinUrl: (url: string) => void;
  setJellyfinUserId: (id: string) => void;
  setJellyfinServerName: (name: string) => void;
  setLibraryServerKind: (kind: LibraryServerKind) => void;
}

export const useIntegrations = create<IntegrationsState>()(
  persist(
    (set) => ({
      radarrUrl: "",
      jellyfinUrl: "",
      jellyfinUserId: "",
      jellyfinServerName: "",
      libraryServerKind: "jellyfin",
      setRadarrUrl: (radarrUrl) => set({ radarrUrl: radarrUrl.trim() }),
      setJellyfinUrl: (jellyfinUrl) => set({ jellyfinUrl: jellyfinUrl.trim() }),
      setJellyfinUserId: (jellyfinUserId) => set({ jellyfinUserId }),
      setJellyfinServerName: (jellyfinServerName) => set({ jellyfinServerName }),
      setLibraryServerKind: (libraryServerKind) => set({ libraryServerKind }),
    }),
    {
      name: "cinelog.integrations.v1",
      storage: createJSONStorage(() => AsyncStorage),
      // Older installs stored Kodi, Sonarr, Trakt, SIMKL, Seerr, Tautulli,
      // and other retired fields in this same key. Copy only the fields this
      // version still uses. A saved Radarr URL is read again.
      merge: (persistedState, currentState) => {
        const next = { ...currentState };
        if (!persistedState || typeof persistedState !== "object") return next;
        const saved = persistedState as Partial<IntegrationsState>;
        const keys = [
          "radarrUrl",
          "jellyfinUrl",
          "jellyfinUserId",
          "jellyfinServerName",
          "libraryServerKind",
        ] as const;
        for (const key of keys) {
          if (saved[key] !== undefined) next[key] = saved[key] as never;
        }
        return next;
      },
    },
  ),
);
