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
  note: string;
  report: string;
  updatedAt: number;
  programmes: GuideProgramme[];
  guideUrl: string;
  begin: (sourceId: string) => void;
  progress: (phase: "download" | "parsing", bytes: number, count: number) => void;
  setNote: (note: string) => void;
  ready: (
    sourceId: string,
    items: IptvEntry[],
    counts: SectionCounts,
    diagnosis: PlaylistDiagnosis | null,
    warnings: string[],
    report?: string,
  ) => void;
  fail: (sourceId: string, error: string, report?: string) => void;
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
  note: "",
  report: "",
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
      note: "",
      report: "",
      programmes: [],
      guideUrl: "",
    }),
  progress: (phase, bytes, count) => set({ phase, bytes, parsed: count }),
  setNote: (note) => set({ note }),
  ready: (sourceId, items, counts, diagnosis, warnings, report = "") =>
    set({
      sourceId,
      items,
      counts,
      diagnosis,
      warnings,
      report,
      note: "",
      phase: "ready",
      error: null,
      updatedAt: Date.now(),
    }),
  fail: (sourceId, error, report = "") =>
    set({ sourceId, phase: "error", error, report, note: "", items: [], diagnosis: null }),
  setGuide: (url, programmes) => set({ guideUrl: url, programmes }),
}));
