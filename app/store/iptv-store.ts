/**
 * Playlists the viewer added. Passwords and stream URLs are not stored here.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_IPTV_USER_AGENT, IPTV_PRESETS, resolveUserAgent } from "@/lib/iptv/http.mjs";

export interface IptvAccount {
  status: string;
  expiry: string;
  maxConnections: string;
  activeConnections: string;
  message: string;
}

export interface IptvCounts {
  live: number;
  movie: number;
  series: number;
}

export interface IptvSource {
  id: string;
  name: string;
  kind: "m3u" | "xtream";
  url: string;
  fileUri: string;
  xmltvUrl: string;
  server: string;
  username: string;
  userAgentPreset: string;
  userAgent: string;
  player: string;
  streamFormat: "ts" | "m3u8";
  epgOffsetHours: number;
  lockedGroups: string[];
  account: IptvAccount | null;
  updatedAt: number;
  counts: IptvCounts | null;
  lastError: string;
}

export interface IptvRecent {
  sourceId: string;
  itemId: string;
  kind: string;
  name: string;
  logo: string;
  at: number;
}

interface IptvState {
  sources: IptvSource[];
  favorites: string[];
  userAgent: string;
  userAgentPreset: string;
  /** media3 uses ExoPlayer directly. expo uses the shared video view. */
  player: string;
  activeSourceId: string;
  recent: IptvRecent[];
  resume: Record<string, number>;
  addSource: (source: IptvSource) => void;
  updateSource: (id: string, patch: Partial<IptvSource>) => void;
  removeSource: (id: string) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  setUserAgent: (userAgent: string) => void;
  setUserAgentPreset: (preset: string) => void;
  setPlayer: (player: string) => void;
  setActiveSource: (id: string) => void;
  setCatalogueMeta: (id: string, counts: IptvCounts, updatedAt: number, lastError?: string) => void;
  remember: (item: IptvRecent) => void;
  setResume: (key: string, positionMs: number) => void;
}

function accountOf(value: unknown): IptvAccount | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<IptvAccount>;
  return {
    status: String(row.status || ""),
    expiry: String(row.expiry || ""),
    maxConnections: String(row.maxConnections || ""),
    activeConnections: String(row.activeConnections || ""),
    message: String(row.message || "").slice(0, 180),
  };
}

export function normalizeSource(raw: Partial<IptvSource> | null | undefined): IptvSource {
  const row = raw ?? {};
  const counts = row.counts;
  return {
    id: String(row.id || ""),
    name: String(row.name || "Playlist").slice(0, 80),
    kind: row.kind === "xtream" ? "xtream" : "m3u",
    url: String(row.url || ""),
    fileUri: String(row.fileUri || ""),
    xmltvUrl: String(row.xmltvUrl || ""),
    server: String(row.server || ""),
    username: String(row.username || ""),
    userAgentPreset: String(row.userAgentPreset || ""),
    userAgent: String(row.userAgent || "").slice(0, 240),
    player: row.player === "expo" || row.player === "media3" || row.player === "vlc" ? row.player : "",
    streamFormat: row.streamFormat === "m3u8" ? "m3u8" : "ts",
    epgOffsetHours: Number(row.epgOffsetHours) || 0,
    lockedGroups: Array.isArray(row.lockedGroups) ? row.lockedGroups.map(String).slice(0, 80) : [],
    account: accountOf(row.account),
    updatedAt: Number(row.updatedAt) || 0,
    counts: counts
      ? {
          live: Number(counts.live) || 0,
          movie: Number(counts.movie) || 0,
          series: Number(counts.series) || 0,
        }
      : null,
    lastError: String(row.lastError || "").slice(0, 180),
  };
}

export function sourceAgent(source: Pick<IptvSource, "userAgentPreset" | "userAgent">, preset: string, custom: string) {
  return resolveUserAgent(source.userAgentPreset || preset || "vlc", source.userAgent || custom);
}

export function sourcePlayer(source: Pick<IptvSource, "player">, fallback: string) {
  if (source.player === "expo" || source.player === "media3" || source.player === "vlc") return source.player;
  return fallback === "expo" ? "expo" : "media3";
}

export function resumeKey(sourceId: string, kind: string, itemId: string) {
  return `${sourceId}:${kind}:${itemId}`;
}

export const useIptv = create<IptvState>()(
  persist(
    (set, get) => ({
      sources: [],
      favorites: [],
      userAgent: DEFAULT_IPTV_USER_AGENT,
      userAgentPreset: "vlc",
      player: "media3",
      activeSourceId: "",
      recent: [],
      resume: {},
      addSource: (source) =>
        set({
          sources: [normalizeSource(source), ...get().sources.filter((item) => item.id !== source.id)],
          activeSourceId: source.id,
        }),
      updateSource: (id, patch) =>
        set({
          sources: get().sources.map((item) => (item.id === id ? normalizeSource({ ...item, ...patch, id }) : item)),
        }),
      removeSource: (id) =>
        set({
          sources: get().sources.filter((item) => item.id !== id),
          favorites: get().favorites.filter((item) => !item.startsWith(`${id}:`)),
          recent: get().recent.filter((item) => item.sourceId !== id),
          activeSourceId: get().activeSourceId === id ? "" : get().activeSourceId,
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
      setPlayer: (player) => set({ player: player === "expo" ? "expo" : "media3" }),
      setActiveSource: (id) => set({ activeSourceId: id }),
      setCatalogueMeta: (id, counts, updatedAt, lastError = "") =>
        set({
          sources: get().sources.map((item) =>
            item.id === id ? { ...item, counts, updatedAt, lastError: lastError.slice(0, 180) } : item,
          ),
        }),
      remember: (item) =>
        set({
          recent: [
            item,
            ...get().recent.filter((row) => !(row.sourceId === item.sourceId && row.kind === item.kind && row.itemId === item.itemId)),
          ].slice(0, 30),
        }),
      setResume: (key, positionMs) => {
        const resume = { ...get().resume, [key]: Math.max(0, Math.round(positionMs)) };
        const keys = Object.keys(resume);
        if (keys.length > 300) delete resume[keys[0]];
        set({ resume });
      },
    }),
    {
      name: "cinelog.iptv.v1",
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<IptvState>;
        const matched = IPTV_PRESETS.find((item) => item.userAgent && item.userAgent === saved.userAgent);
        const preset = saved.userAgentPreset || matched?.id || (saved.userAgent ? "custom" : current.userAgentPreset);
        const sources = Array.isArray(saved.sources) ? saved.sources.map((item) => normalizeSource(item)).filter((item) => item.id) : [];
        return {
          ...current,
          ...saved,
          sources,
          favorites: Array.isArray(saved.favorites) ? saved.favorites.map(String).slice(0, 500) : [],
          recent: Array.isArray(saved.recent)
            ? saved.recent.slice(0, 30).map((item) => ({
                sourceId: String(item.sourceId || ""),
                itemId: String(item.itemId || ""),
                kind: String(item.kind || "live"),
                name: String(item.name || ""),
                logo: String(item.logo || ""),
                at: Number(item.at) || 0,
              }))
            : [],
          resume: saved.resume && typeof saved.resume === "object" ? saved.resume : {},
          activeSourceId: String(saved.activeSourceId || ""),
          userAgent: saved.userAgent?.trim() || current.userAgent,
          userAgentPreset: preset,
          player: saved.player === "expo" ? "expo" : "media3",
        };
      },
    },
  ),
);

export function iptvPasswordKey(sourceId: string): string {
  return `cinelog.iptv.pass.${sourceId}`;
}

export function iptvPinKey(sourceId: string): string {
  return `cinelog.iptv.pin.${sourceId}`;
}
