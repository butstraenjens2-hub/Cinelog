/**
 * Loads a playlist the viewer configured. Nothing here is bundled with the app.
 */

import { parseXmltv } from "@/lib/live/xmltv.mjs";
import { fetchPlaylist } from "@/lib/iptv/http.mjs";
import { parseM3u } from "@/lib/iptv/m3u.mjs";
import {
  formatCatchupStart,
  mapXtreamCategories,
  mapXtreamStreams,
  xtreamApiUrl,
  xtreamCatchupUrl,
  xtreamEpisodeUrl,
  xtreamLiveUrl,
  xtreamVodUrl,
} from "@/lib/iptv/xtream.mjs";

export interface IptvEntry {
  id: string;
  name: string;
  group: string;
  groupName: string;
  tvgId: string;
  logo: string;
  url: string;
  kind: "live" | "movie" | "series";
  archiveHours: number;
  streamId: number;
  extension: string;
}

async function fetchText(url: string, userAgent?: string): Promise<string> {
  return fetchPlaylist(url, { userAgent });
}

async function fetchJson(url: string, userAgent?: string): Promise<unknown> {
  const text = await fetchText(url, userAgent);
  return JSON.parse(text) as unknown;
}

export function entriesFromM3u(text: string): IptvEntry[] {
  return parseM3u(text).map((item) => ({
    id: item.id,
    name: String(item.name),
    group: String(item.group),
    groupName: String(item.group),
    tvgId: String(item.tvgId),
    logo: String(item.logo),
    url: item.url,
    kind: item.kind === "movie" || item.kind === "series" ? item.kind : "live",
    archiveHours: 0,
    streamId: 0,
    extension: "",
  }));
}

export async function loadM3uUrl(url: string, userAgent?: string): Promise<IptvEntry[]> {
  return entriesFromM3u(await fetchText(url, userAgent));
}

export async function loadXtreamCatalogue(
  server: string,
  username: string,
  password: string,
  userAgent?: string,
): Promise<IptvEntry[]> {
  const [liveCats, live, vodCats, vod, seriesCats, series] = await Promise.all([
    fetchJson(xtreamApiUrl(server, username, password, "get_live_categories"), userAgent),
    fetchJson(xtreamApiUrl(server, username, password, "get_live_streams"), userAgent),
    fetchJson(xtreamApiUrl(server, username, password, "get_vod_categories"), userAgent),
    fetchJson(xtreamApiUrl(server, username, password, "get_vod_streams"), userAgent),
    fetchJson(xtreamApiUrl(server, username, password, "get_series_categories"), userAgent),
    fetchJson(xtreamApiUrl(server, username, password, "get_series"), userAgent),
  ]);
  const names = new Map<string, string>();
  for (const category of [
    ...mapXtreamCategories(liveCats),
    ...mapXtreamCategories(vodCats),
    ...mapXtreamCategories(seriesCats),
  ]) {
    names.set(category.id, category.name);
  }
  const mapRows = (rows: unknown, kind: "live" | "movie" | "series"): IptvEntry[] =>
    mapXtreamStreams(rows, kind).flatMap((row) => {
      if (!row) return [];
      const entryKind = row.kind === "movie" || row.kind === "series" ? row.kind : "live";
      return [{
        id: row.id,
        name: row.name,
        group: row.group,
        groupName: names.get(row.group) || "",
        tvgId: row.tvgId,
        logo: row.logo,
        url: "",
        kind: entryKind,
        archiveHours: row.archiveHours,
        streamId: row.streamId,
        extension: row.extension,
      }];
    });
  return [...mapRows(live, "live"), ...mapRows(vod, "movie"), ...mapRows(series, "series")];
}

export function xtreamPlayUrl(
  server: string,
  username: string,
  password: string,
  item: IptvEntry,
): string {
  if (item.kind === "movie") return xtreamVodUrl(server, username, password, item.streamId, item.extension);
  if (item.kind === "series") return xtreamEpisodeUrl(server, username, password, item.streamId, item.extension);
  return xtreamLiveUrl(server, username, password, item.streamId);
}

export function xtreamCatchupPlayUrl(
  server: string,
  username: string,
  password: string,
  item: IptvEntry,
  minutesAgo: number,
): string {
  const start = formatCatchupStart(Date.now() - minutesAgo * 60 * 1000);
  return xtreamCatchupUrl(server, username, password, item.streamId, start, minutesAgo);
}

export interface IptvEpisode {
  id: string;
  name: string;
  url: string;
}

export async function loadXtreamEpisodes(
  server: string,
  username: string,
  password: string,
  seriesId: number,
  userAgent?: string,
): Promise<IptvEpisode[]> {
  const info = (await fetchJson(
    xtreamApiUrl(server, username, password, "get_series_info", { series_id: seriesId }),
    userAgent,
  )) as { episodes?: Record<string, Array<Record<string, unknown>>> };
  const episodes = info?.episodes && typeof info.episodes === "object" ? info.episodes : {};
  const rows: IptvEpisode[] = [];
  for (const [season, list] of Object.entries(episodes)) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const id = String(row.id ?? "");
      if (!id) continue;
      const episode = String(row.episode_num ?? "");
      const title = String(row.title ?? "");
      rows.push({
        id,
        name: `S${season.padStart(2, "0")}E${episode.padStart(2, "0")} ${title}`.trim(),
        url: xtreamEpisodeUrl(server, username, password, id, String(row.container_extension ?? "mp4")),
      });
    }
  }
  return rows;
}

export async function loadGuide(url: string, userAgent?: string) {
  const text = await fetchText(url, userAgent);
  return parseXmltv(text.slice(0, 2_000_000));
}
