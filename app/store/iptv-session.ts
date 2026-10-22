/**
 * The playlist currently loaded in memory. Entries are not persisted:
 * an M3U row can carry a token in its address.
 */

import { create } from "zustand";

import type { IptvEntry, PlaylistDiagnosis, SectionCounts } from "@/lib/iptv/load";

export type LoadPhase = "idle" | "download" | "parsing" | "ready" | "error";

interface GuideProgramme {
  channelId: string;
  startMs: number;
  stopMs: number;
  title: string;
  summary: string;
}

interface SessionState {
  sourceId: string;
  items: IptvEntry[];
  counts: SectionCounts;
  warnings: string[];
  diagnosis: PlaylistDiagnosis | null;
  phase: LoadPhase;
  bytes: number;
  parsed: number;
  error: string | null;
  updatedAt: number;
  programmes: GuideProgramme[];
  guideUrl: string;
  begin: (sourceId: string) => void;
  progress: (phase: "download" | "parsing", bytes: number, count: number) => void;
  ready: (sourceId: string, items: IptvEntry[], counts: SectionCounts, diagnosis: PlaylistDiagnosis | null, warnings: string[]) => void;
  fail: (sourceId: string, error: string) => void;
  setGuide: (url: string, programmes: GuideProgramme[]) => void;
}

const emptyCounts = { live: 0, movie: 0, series: 0 };

export const useIptvSession = create<SessionState>((set) => ({
  sourceId: "",
  items: [],
  counts: emptyCounts,
  warnings: [],
  diagnosis: null,
  phase: "idle",
  bytes: 0,
  parsed: 0,
  error: null,
  updatedAt: 0,
  programmes: [],
  guideUrl: "",
  begin: (sourceId) =>
    set({
      sourceId,
      items: [],
      counts: emptyCounts,
      warnings: [],
      diagnosis: null,
      phase: "download",
      bytes: 0,
      parsed: 0,
      error: null,
      programmes: [],
      guideUrl: "",
    }),
  progress: (phase, bytes, count) => set({ phase, bytes, parsed: count }),
  ready: (sourceId, items, counts, diagnosis, warnings) =>
    set({
      sourceId,
      items,
      counts,
      diagnosis,
      warnings,
      phase: "ready",
      error: null,
      updatedAt: Date.now(),
    }),
  fail: (sourceId, error) => set({ sourceId, phase: "error", error, items: [], diagnosis: null }),
  setGuide: (url, programmes) => set({ guideUrl: url, programmes }),
}));
