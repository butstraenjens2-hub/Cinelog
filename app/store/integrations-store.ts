/**
 * Non-secret integration preferences. API keys and tokens stay in
 * `lib/secrets.ts` (device keystore), never in this persisted store.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type LibraryServerKind = "jellyfin" | "emby";

export interface IntegrationsState {
  jellyfinUrl: string;
  jellyfinUserId: string;
  jellyfinServerName: string;
  libraryServerKind: LibraryServerKind;
  setJellyfinUrl: (url: string) => void;
  setJellyfinUserId: (id: string) => void;
  setJellyfinServerName: (name: string) => void;
  setLibraryServerKind: (kind: LibraryServerKind) => void;
}

export const useIntegrations = create<IntegrationsState>()(
  persist(
    (set) => ({
      jellyfinUrl: "",
      jellyfinUserId: "",
      jellyfinServerName: "",
      libraryServerKind: "jellyfin",
      setJellyfinUrl: (jellyfinUrl) => set({ jellyfinUrl: jellyfinUrl.trim() }),
      setJellyfinUserId: (jellyfinUserId) => set({ jellyfinUserId }),
      setJellyfinServerName: (jellyfinServerName) => set({ jellyfinServerName }),
      setLibraryServerKind: (libraryServerKind) => set({ libraryServerKind }),
    }),
    {
      name: "cinelog.integrations.v1",
      storage: createJSONStorage(() => AsyncStorage),
      // Older installs stored Kodi, Sonarr, Radarr, Trakt, SIMKL, Seerr,
      // Tautulli, and other retired fields in this same key. Copy only the
      // fields this version still uses and leave the rest unread.
      merge: (persistedState, currentState) => {
        const next = { ...currentState };
        if (!persistedState || typeof persistedState !== "object") return next;
        const saved = persistedState as Partial<IntegrationsState>;
        const keys = [
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
