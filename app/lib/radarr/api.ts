/**
 * Radarr REST API v3. Talks only to the server URL the viewer configured.
 * The API key is a header, never part of the URL.
 */

import { movieAddBody } from "@/lib/radarr/body.mjs";
import { asNumber, asRecord, asText, ownFetch, OwnServerError } from "@/lib/own-server/http";

const ROOT = "/api/v3";

export interface RadarrOption {
  id: number;
  name: string;
}

export interface RadarrStatus {
  appName: string;
  version: string;
  instanceName: string;
}

export interface RadarrMovieState {
  inLibrary: boolean;
  downloaded: boolean;
}

function radarrFetch<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined>;
  } = {},
): Promise<T> {
  const key = apiKey.trim();
  if (!key) throw new OwnServerError(0, "API key is required.");
  return ownFetch<T>(baseUrl, path, {
    ...options,
    headers: { "X-Api-Key": key },
  });
}

export async function testRadarr(baseUrl: string, apiKey: string): Promise<RadarrStatus> {
  const raw = await radarrFetch<Record<string, unknown>>(baseUrl, apiKey, `${ROOT}/system/status`);
  return {
    appName: asText(raw.appName) || "Radarr",
    version: asText(raw.version),
    instanceName: asText(raw.instanceName),
  };
}

export async function radarrQualityProfiles(baseUrl: string, apiKey: string): Promise<RadarrOption[]> {
  const rows = await radarrFetch<unknown[]>(baseUrl, apiKey, `${ROOT}/qualityprofile`);
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const raw = asRecord(row);
      return { id: asNumber(raw.id), name: asText(raw.name) || `Profile ${asNumber(raw.id)}` };
    })
    .filter((row) => row.id > 0);
}

export async function radarrRootFolders(baseUrl: string, apiKey: string): Promise<RadarrOption[]> {
  const rows = await radarrFetch<unknown[]>(baseUrl, apiKey, `${ROOT}/rootfolder`);
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({ id: index + 1, name: asText(asRecord(row).path) }))
    .filter((row) => row.name);
}

/** Whether this TMDB movie is already in the viewer's Radarr library, and if the file is on disk. */
export async function radarrMovieState(
  baseUrl: string,
  apiKey: string,
  tmdbId: number,
): Promise<RadarrMovieState> {
  const rows = await radarrFetch<unknown[]>(baseUrl, apiKey, `${ROOT}/movie`, {
    query: { tmdbId },
  });
  const match = (Array.isArray(rows) ? rows : [])
    .map((row) => asRecord(row))
    .find((row) => asNumber(row.tmdbId) === tmdbId && asNumber(row.id) > 0);
  if (!match) return { inLibrary: false, downloaded: false };
  return { inLibrary: true, downloaded: Boolean(match.hasFile) };
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
  const found = await radarrFetch<unknown[]>(baseUrl, apiKey, `${ROOT}/movie/lookup`, {
    query: { term: `tmdb:${tmdbId}` },
  });
  const lookup = Array.isArray(found) ? asRecord(found[0]) : {};
  if (!asText(lookup.title) && !asNumber(lookup.tmdbId)) {
    throw new OwnServerError(0, "Radarr could not match this movie.");
  }
  await radarrFetch(baseUrl, apiKey, `${ROOT}/movie`, {
    method: "POST",
    body: movieAddBody(lookup, options),
  });
}
