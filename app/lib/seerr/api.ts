/**
 * Seerr and Overseerr public API. Requests go to the viewer's own server.
 */

import { servarrFetch } from "@/lib/servarr/http";
import { asText } from "@/lib/own-server/http";

export async function testSeerr(baseUrl: string, apiKey: string): Promise<string> {
  const raw = await servarrFetch<Record<string, unknown>>(baseUrl, apiKey, "/api/v1/settings/public");
  return asText(raw.applicationTitle) || asText(raw.applicationUrl) || "Seerr";
}

export interface SeerrChoice {
  id: number;
  name: string;
}

export interface SeerrServerOption {
  id: number;
  name: string;
  profiles: SeerrChoice[];
  folders: SeerrChoice[];
}

export interface SeerrSeason {
  seasonNumber: number;
  episodeCount: number;
  name: string;
}

function choices(value: unknown, labelKey: "name" | "path"): SeerrChoice[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      const raw = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      const name = asText(raw[labelKey] || raw.name);
      return { id: Number(raw.id) || 0, name };
    })
    .filter((row) => row.name);
}

export async function seerrServers(
  baseUrl: string,
  apiKey: string,
  mediaType: "movie" | "tv",
): Promise<SeerrServerOption[]> {
  const path = mediaType === "movie" ? "/api/v1/service/radarr" : "/api/v1/service/sonarr";
  const payload = await servarrFetch<unknown>(baseUrl, apiKey, path);
  const rows = Array.isArray(payload) ? payload : [];
  return rows.map((row) => {
    const raw = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const folders = choices(raw.rootFolders, "path");
    const active = asText(raw.activeDirectory);
    return {
      id: Number(raw.id) || 0,
      name: asText(raw.name) || "Server",
      profiles: choices(raw.profiles ?? raw.qualityProfiles, "name"),
      folders: folders.length ? folders : active ? [{ id: 0, name: active }] : [],
    };
  });
}

export async function seerrSeasons(
  baseUrl: string,
  apiKey: string,
  tmdbId: number,
): Promise<SeerrSeason[]> {
  const raw = await servarrFetch<Record<string, unknown>>(baseUrl, apiKey, `/api/v1/tv/${tmdbId}`);
  const rows = Array.isArray(raw.seasons) ? raw.seasons : [];
  return rows
    .map((row) => {
      const season = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return {
        seasonNumber: Number(season.seasonNumber ?? season.season_number) || 0,
        episodeCount: Number(season.episodeCount ?? season.episode_count) || 0,
        name: asText(season.name) || `Season ${Number(season.seasonNumber) || ""}`,
      };
    })
    .filter((season) => season.seasonNumber > 0);
}

export async function requestOnSeerr(
  baseUrl: string,
  apiKey: string,
  input: {
    mediaType: "movie" | "tv";
    tmdbId: number;
    serverId?: number;
    profileId?: number;
    rootFolder?: string;
    seasons?: number[] | "all";
  },
): Promise<void> {
  await servarrFetch(baseUrl, apiKey, "/api/v1/request", {
    method: "POST",
    body: {
      mediaType: input.mediaType,
      mediaId: input.tmdbId,
      ...(input.serverId ? { serverId: input.serverId } : {}),
      ...(input.profileId ? { profileId: input.profileId } : {}),
      ...(input.rootFolder ? { rootFolder: input.rootFolder } : {}),
      ...(input.mediaType === "tv" ? { seasons: input.seasons ?? "all" } : {}),
    },
  });
}
