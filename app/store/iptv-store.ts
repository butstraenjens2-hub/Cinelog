/**
 * Playlists the viewer added. Passwords are not stored here.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_IPTV_USER_AGENT, IPTV_PRESETS } from "@/lib/iptv/http.mjs";

export interface IptvSource {
  id: string;
  name: string;
  kind: "m3u" | "xtream";
  url: string;
  fileUri: string;
  xmltvUrl: string;
  server: string;
  username: string;
}

interface IptvState {
  sources: IptvSource[];
  favorites: string[];
  userAgent: string;
  userAgentPreset: string;
  addSource: (source: IptvSource) => void;
  removeSource: (id: string) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  setUserAgent: (userAgent: string) => void;
  setUserAgentPreset: (preset: string) => void;
}

export const useIptv = create<IptvState>()(
  persist(
    (set, get) => ({
      sources: [],
      favorites: [],
      userAgent: DEFAULT_IPTV_USER_AGENT,
      userAgentPreset: "vlc",
      addSource: (source) =>
        set({ sources: [source, ...get().sources.filter((item) => item.id !== source.id)] }),
      removeSource: (id) =>
        set({
          sources: get().sources.filter((item) => item.id !== id),
          favorites: get().favorites.filter((item) => !item.startsWith(`${id}:`)),
        }),
      toggleFavorite: (id) =>
        set({
          favorites: get().favorites.includes(id)
            ? get().favorites.filter((item) => item !== id)
            : [id, ...get().favorites],
        }),
      isFavorite: (id) => get().favorites.includes(id),
      setUserAgent: (userAgent) => set({ userAgent: userAgent.slice(0, 240), userAgentPreset: "custom" }),
      setUserAgentPreset: (preset) => {
        const known = IPTV_PRESETS.some((item) => item.id === preset);
        set({ userAgentPreset: known ? preset : "vlc" });
      },
    }),
    {
      name: "cinelog.iptv.v1",
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<IptvState>;
        const matched = IPTV_PRESETS.find((item) => item.userAgent && item.userAgent === saved.userAgent);
        const preset = saved.userAgentPreset || matched?.id || (saved.userAgent ? "custom" : current.userAgentPreset);
        return {
          ...current,
          ...saved,
          userAgent: saved.userAgent?.trim() || current.userAgent,
          userAgentPreset: preset,
        };
      },
    },
  ),
);

export function iptvPasswordKey(sourceId: string): string {
  return `cinelog.iptv.pass.${sourceId}`;
}
