/**
 * Sonarr REST API v3. Talks only to the server URL the viewer configured.
 */

import { seriesAddBody } from "@/lib/servarr/url.mjs";
import {
  asNumber,
  asRecord,
  asText,
  isoDay,
  servarrFetch,
} from "@/lib/servarr/http";

export interface SonarrStatus {
  appName: string;
  version: string;
  instanceName: string;
}

export interface SonarrOption {
  id: number;
  name: string;
}

export interface SonarrSeriesRow {
  id: number;
  title: string;
  year: number;
  monitored: boolean;
  status: string;
  episodeFileCount: number;
  episodeCount: number;
  totalEpisodeCount: number;
  tmdbId: number;
}

export interface SonarrListRow {
  id: string;
  title: string;
  meta: string;
}

const ROOT = "/api/v3";

export function testSonarr(baseUrl: string, apiKey: string): Promise<SonarrStatus> {
  return servarrFetch<Record<string, unknown>>(baseUrl, apiKey, `${ROOT}/system/status`).then(
    (raw) => ({
      appName: asText(raw.appName) || "Sonarr",
      version: asText(raw.version),
      instanceName: asText(raw.instanceName),
    }),
  );
}

export async function sonarrQualityProfiles(
  baseUrl: string,
  apiKey: string,
): Promise<SonarrOption[]> {
  const rows = await servarrFetch<unknown[]>(baseUrl, apiKey, `${ROOT}/qualityprofile`);
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const raw = asRecord(row);
    return { id: asNumber(raw.id), name: asText(raw.name) || `Profile ${asNumber(raw.id)}` };
  }).filter((row) => row.id > 0);
}

export async function sonarrRootFolders(
  baseUrl: string,
  apiKey: string,
): Promise<SonarrOption[]> {
  const rows = await servarrFetch<unknown[]>(baseUrl, apiKey, `${ROOT}/rootfolder`);
  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const raw = asRecord(row);
    const path = asText(raw.path);
    return { id: index + 1, name: path };
  }).filter((row) => row.name);
}

export async function sonarrSeries(
  baseUrl: string,
  apiKey: string,
): Promise<SonarrSeriesRow[]> {
  const rows = await servarrFetch<unknown[]>(baseUrl, apiKey, `${ROOT}/series`);
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const raw = asRecord(row);
    const stats = asRecord(raw.statistics);
    return {
      id: asNumber(raw.id),
      title: asText(raw.title),
      year: asNumber(raw.year),
      monitored: Boolean(raw.monitored),
      status: asText(raw.status),
      episodeFileCount: asNumber(stats.episodeFileCount),
      episodeCount: asNumber(stats.episodeCount),
      totalEpisodeCount: asNumber(stats.totalEpisodeCount),
      tmdbId: asNumber(raw.tmdbId),
    };
  });
}

export async function sonarrMissing(
  baseUrl: string,
  apiKey: string,
): Promise<SonarrListRow[]> {
  const page = await servarrFetch<Record<string, unknown>>(baseUrl, apiKey, `${ROOT}/wanted/missing`, {
    query: { page: 1, pageSize: 40, sortKey: "airDateUtc", sortDirection: "descending" },
  });
  const records = Array.isArray(page.records) ? page.records : [];
  return records.map((row) => {
    const raw = asRecord(row);
    const series = asRecord(raw.series);
    const season = asNumber(raw.seasonNumber);
    const episode = asNumber(raw.episodeNumber);
    return {
      id: String(asNumber(raw.id) || `${season}-${episode}-${asText(raw.title)}`),
      title: asText(raw.title) || "Episode",
      meta: `${asText(series.title) || "Series"} · S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`,
    };
  });
}

export async function sonarrCalendar(
  baseUrl: string,
  apiKey: string,
): Promise<SonarrListRow[]> {
  const start = new Date();
  const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
  const rows = await servarrFetch<unknown[]>(baseUrl, apiKey, `${ROOT}/calendar`, {
    query: { start: isoDay(start), end: isoDay(end), includeSeries: true, unmonitored: false },
  });
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const raw = asRecord(row);
    const series = asRecord(raw.series);
    const when = asText(raw.airDateUtc || raw.airDate).slice(0, 16).replace("T", " ");
    return {
      id: String(asNumber(raw.id) || `${raw.seasonNumber}-${raw.episodeNumber}-${when}`),
      title: `${asText(series.title) || "Series"} · ${asText(raw.title)}`,
      meta: when || "Upcoming",
    };
  });
}

export async function sonarrQueue(
  baseUrl: string,
  apiKey: string,
): Promise<SonarrListRow[]> {
  const page = await servarrFetch<Record<string, unknown>>(baseUrl, apiKey, `${ROOT}/queue`, {
    query: { page: 1, pageSize: 40, includeUnknownSeriesItems: false },
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

export async function sonarrHistory(
  baseUrl: string,
  apiKey: string,
): Promise<SonarrListRow[]> {
  const page = await servarrFetch<Record<string, unknown>>(baseUrl, apiKey, `${ROOT}/history`, {
    query: { page: 1, pageSize: 40, sortKey: "date", sortDirection: "descending" },
  });
  const records = Array.isArray(page.records) ? page.records : [];
  return records.map((row) => {
    const raw = asRecord(row);
    const series = asRecord(raw.series);
    return {
      id: String(asNumber(raw.id) || asText(raw.date)),
      title: asText(series.title) || asText(raw.sourceTitle) || "History",
      meta: `${asText(raw.eventType) || "event"} · ${asText(raw.date).slice(0, 16).replace("T", " ")}`,
    };
  });
}

export async function addSeriesToSonarr(
  baseUrl: string,
  apiKey: string,
  tmdbId: number,
  options: {
    qualityProfileId: number;
    rootFolderPath: string;
    searchForMissingEpisodes: boolean;
  },
): Promise<void> {
  const found = await servarrFetch<unknown[]>(baseUrl, apiKey, `${ROOT}/series/lookup`, {
    query: { term: `tmdb:${tmdbId}` },
  });
  const lookup = Array.isArray(found) ? asRecord(found[0]) : {};
  if (!asText(lookup.title) && !asNumber(lookup.tvdbId)) {
    throw new Error("Sonarr could not match this series.");
  }
  await servarrFetch(baseUrl, apiKey, `${ROOT}/series`, {
    method: "POST",
    body: seriesAddBody(lookup, options),
  });
}
