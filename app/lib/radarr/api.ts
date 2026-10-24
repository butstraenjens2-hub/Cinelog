/**
 * Radarr REST API v3. Talks only to the server URL the viewer configured.
 */

import { movieAddBody } from "@/lib/servarr/url.mjs";
import {
  asNumber,
  asRecord,
  asText,
  isoDay,
  servarrFetch,
} from "@/lib/servarr/http";
import type { SonarrListRow, SonarrOption, SonarrStatus } from "@/lib/sonarr/api";

const ROOT = "/api/v3";

export interface RadarrMovieRow {
  id: number;
  title: string;
  year: number;
  monitored: boolean;
  hasFile: boolean;
  status: string;
  tmdbId: number;
}

export function testRadarr(baseUrl: string, apiKey: string): Promise<SonarrStatus> {
  return servarrFetch<Record<string, unknown>>(baseUrl, apiKey, `${ROOT}/system/status`).then(
    (raw) => ({
      appName: asText(raw.appName) || "Radarr",
      version: asText(raw.version),
      instanceName: asText(raw.instanceName),
    }),
  );
}

export async function radarrQualityProfiles(
  baseUrl: string,
  apiKey: string,
): Promise<SonarrOption[]> {
  const rows = await servarrFetch<unknown[]>(baseUrl, apiKey, `${ROOT}/qualityprofile`);
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const raw = asRecord(row);
      return { id: asNumber(raw.id), name: asText(raw.name) || `Profile ${asNumber(raw.id)}` };
    })
    .filter((row) => row.id > 0);
}

export async function radarrRootFolders(
  baseUrl: string,
  apiKey: string,
): Promise<SonarrOption[]> {
  const rows = await servarrFetch<unknown[]>(baseUrl, apiKey, `${ROOT}/rootfolder`);
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({ id: index + 1, name: asText(asRecord(row).path) }))
    .filter((row) => row.name);
}

export async function radarrMovies(
  baseUrl: string,
  apiKey: string,
): Promise<RadarrMovieRow[]> {
  const rows = await servarrFetch<unknown[]>(baseUrl, apiKey, `${ROOT}/movie`);
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const raw = asRecord(row);
    return {
      id: asNumber(raw.id),
      title: asText(raw.title),
      year: asNumber(raw.year),
      monitored: Boolean(raw.monitored),
      hasFile: Boolean(raw.hasFile),
      status: asText(raw.status),
      tmdbId: asNumber(raw.tmdbId),
    };
  });
}

export async function radarrMissing(
  baseUrl: string,
  apiKey: string,
): Promise<SonarrListRow[]> {
  const page = await servarrFetch<Record<string, unknown>>(baseUrl, apiKey, `${ROOT}/wanted/missing`, {
    query: { page: 1, pageSize: 40, sortKey: "title", sortDirection: "ascending" },
  });
  const records = Array.isArray(page.records) ? page.records : [];
  return records.map((row) => {
    const raw = asRecord(row);
    return {
      id: String(asNumber(raw.id) || asText(raw.title)),
      title: asText(raw.title) || "Movie",
      meta: `${asNumber(raw.year) || "—"} · ${raw.monitored === false ? "Unmonitored" : "Missing file"}`,
    };
  });
}

export async function radarrCalendar(
  baseUrl: string,
  apiKey: string,
): Promise<SonarrListRow[]> {
  const start = new Date();
  const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const rows = await servarrFetch<unknown[]>(baseUrl, apiKey, `${ROOT}/calendar`, {
    query: { start: isoDay(start), end: isoDay(end), unmonitored: false },
  });
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const raw = asRecord(row);
    return {
      id: String(asNumber(raw.id) || asText(raw.title)),
      title: asText(raw.title) || "Movie",
      meta: asText(raw.inCinemas || raw.digitalRelease || raw.physicalRelease).slice(0, 10) || "Upcoming",
    };
  });
}

export async function radarrQueue(
  baseUrl: string,
  apiKey: string,
): Promise<SonarrListRow[]> {
  const page = await servarrFetch<Record<string, unknown>>(baseUrl, apiKey, `${ROOT}/queue`, {
    query: { page: 1, pageSize: 40, includeUnknownMovieItems: false },
  });
  const records = Array.isArray(page.records) ? page.records : [];
  return records.map((row) => {
    const raw = asRecord(row);
    return {
      id: String(asNumber(raw.id) || asText(raw.title)),
      title: asText(raw.title) || "Queue item",
      meta: asText(raw.status) || "queued",
    };
  });
}

export async function radarrHistory(
  baseUrl: string,
  apiKey: string,
): Promise<SonarrListRow[]> {
  const page = await servarrFetch<Record<string, unknown>>(baseUrl, apiKey, `${ROOT}/history`, {
    query: { page: 1, pageSize: 40, sortKey: "date", sortDirection: "descending" },
  });
  const records = Array.isArray(page.records) ? page.records : [];
  return records.map((row) => {
    const raw = asRecord(row);
    const movie = asRecord(raw.movie);
    return {
      id: String(asNumber(raw.id) || asText(raw.date)),
      title: asText(movie.title) || asText(raw.sourceTitle) || "History",
      meta: `${asText(raw.eventType) || "event"} · ${asText(raw.date).slice(0, 16).replace("T", " ")}`,
    };
  });
}

export async function addMovieToRadarr(
  baseUrl: string,
  apiKey: string,
  tmdbId: number,
  options: {
    qualityProfileId: number;
    rootFolderPath: string;
    searchForMovie: boolean;
  },
): Promise<void> {
  const found = await servarrFetch<unknown[]>(baseUrl, apiKey, `${ROOT}/movie/lookup`, {
    query: { term: `tmdb:${tmdbId}` },
  });
  const lookup = Array.isArray(found) ? asRecord(found[0]) : {};
  if (!asText(lookup.title) && !asNumber(lookup.tmdbId)) {
    throw new Error("Radarr could not match this movie.");
  }
  await servarrFetch(baseUrl, apiKey, `${ROOT}/movie`, {
    method: "POST",
    body: movieAddBody(lookup, options),
  });
}
