/**
 * Loads a playlist the viewer configured. Nothing here is bundled with the app.
 */

import { parseXmltv } from "@/lib/live/xmltv.mjs";
import { exchangePlaylist, formatExchangeReport } from "@/lib/iptv/http.mjs";
import { classifyPlaylist, parseM3u, playlistDiagnosis, sectionCounts } from "@/lib/iptv/m3u.mjs";
import { readM3uEntries, readStep } from "@/lib/iptv/transport";
import {
  formatCatchupStart,
  mapXtreamAccount,
  mapXtreamCategories,
  mapXtreamInfo,
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

export interface SectionCounts {
  live: number;
  movie: number;
  series: number;
}

export interface PlaylistDiagnosis {
  reason: string;
  snippet: string;
  status: number;
  contentType: string;
  bytes: number;
  details: string[];
}

export interface PlaylistLoad {
  items: IptvEntry[];
  counts: SectionCounts;
  diagnosis: PlaylistDiagnosis | null;
  warnings: string[];
  /** Sanitized steps from a fallback load. Empty when the first fetch succeeded. */
  report?: string;
}

function toEntry(item: {
  id?: string;
  name?: string;
  group?: string;
  tvgId?: string;
  logo?: string;
  url?: string;
  kind?: string;
}): IptvEntry {
  const kind = item.kind === "movie" || item.kind === "series" ? item.kind : "live";
  return {
    id: String(item.id || item.url || ""),
    name: String(item.name || "Channel"),
    group: String(item.group || ""),
    groupName: String(item.group || ""),
    tvgId: String(item.tvgId || ""),
    logo: String(item.logo || ""),
    url: String(item.url || ""),
    kind,
    archiveHours: 0,
    streamId: 0,
    extension: "",
  };
}

export function entriesFromM3u(text: string): IptvEntry[] {
  return parseM3u(text).map((item) => toEntry(item));
}

function headerValue(headers: Record<string, string> | undefined, name: string) {
  const needle = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() === needle) return String(value || "");
  }
  return "";
}

export function loadM3uText(
  text: string,
  meta: { status?: number; contentType?: string; bytes?: number } = {},
): PlaylistLoad {
  const report = classifyPlaylist(text, meta);
  const diagnosis = playlistDiagnosis(report) as PlaylistDiagnosis | null;
  return {
    items: report.items.map((item: Parameters<typeof toEntry>[0]) => toEntry(item)),
    counts: report.counts,
    diagnosis,
    warnings: [],
  };
}

export async function loadM3uUrl(url: string, userAgent?: string): Promise<PlaylistLoad> {
  const native = await readM3uEntries(url, userAgent);
  if (native) {
    return {
      items: native.items,
      counts: sectionCounts(native.items),
      diagnosis: native.items.length
        ? null
        : {
            reason: native.reason || "not #EXTM3U",
            snippet: native.snippet,
            status: native.status,
            contentType: native.contentType,
            bytes: native.bytes,
            details: native.details,
          },
      warnings: [],
    };
  }
  const exchange = await exchangePlaylist(url, { userAgent, step: "Playlist" });
  const report = classifyPlaylist(exchange.body, {
    status: exchange.status,
    contentType: headerValue(exchange.responseHeaders, "content-type"),
    bytes: String(exchange.body || "").length,
  });
  const diagnosis = playlistDiagnosis(report, formatExchangeReport(exchange)) as PlaylistDiagnosis | null;
  return {
    items: report.items.map((item: Parameters<typeof toEntry>[0]) => toEntry(item)),
    counts: report.counts,
    diagnosis,
    warnings: [],
  };
}

async function fetchJsonStep(step: string, url: string, userAgent?: string): Promise<unknown> {
  try {
    const text = await readStep(url, userAgent, step);
    return JSON.parse(text) as unknown;
  } catch (cause) {
    if (cause instanceof SyntaxError) {
      throw new Error(`${step}: the server did not return JSON.`);
    }
    throw cause;
  }
}

function assertXtreamLogin(payload: unknown) {
  const info = payload as { user_info?: { auth?: number | string; message?: string } };
  const auth = info?.user_info?.auth;
  if (auth === 0 || auth === "0") {
    const message = String(info.user_info?.message || "Login was refused.").slice(0, 180);
    throw new Error(`Sign in: ${message}`);
  }
}

export interface XtreamCatalogue {
  items: IptvEntry[];
  warnings: string[];
}

export async function loadXtreamCatalogue(
  server: string,
  username: string,
  password: string,
  userAgent?: string,
): Promise<XtreamCatalogue> {
  assertXtreamLogin(await fetchJsonStep("Sign in", xtreamApiUrl(server, username, password, ""), userAgent));
  const warnings: string[] = [];
  const take = async (step: string, action: string) => {
    try {
      return await fetchJsonStep(step, xtreamApiUrl(server, username, password, action), userAgent);
    } catch (cause) {
      warnings.push(cause instanceof Error ? cause.message : step);
      return [];
    }
  };
  const liveCats = await take("Live categories", "get_live_categories");
  const live = await take("Live streams", "get_live_streams");
  const vodCats = await take("Movie categories", "get_vod_categories");
  const vod = await take("Movies", "get_vod_streams");
  const seriesCats = await take("Series categories", "get_series_categories");
  const series = await take("Series", "get_series");
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
  const items = [...mapRows(live, "live"), ...mapRows(vod, "movie"), ...mapRows(series, "series")];
  if (!items.length && warnings.length) throw new Error(warnings.join("\n"));
  return { items, warnings };
}

export function xtreamPlayUrl(
  server: string,
  username: string,
  password: string,
  item: IptvEntry,
  liveExtension?: string,
): string {
  if (item.kind === "movie") return xtreamVodUrl(server, username, password, item.streamId, item.extension);
  if (item.kind === "series") return xtreamEpisodeUrl(server, username, password, item.streamId, item.extension);
  return xtreamLiveUrl(server, username, password, item.streamId, liveExtension || item.extension || "ts");
}

export interface XtreamAccount {
  status: string;
  expiry: string;
  maxConnections: string;
  activeConnections: string;
  message: string;
}

export async function loadXtreamAccount(
  server: string,
  username: string,
  password: string,
  userAgent?: string,
): Promise<XtreamAccount> {
  const payload = await fetchJsonStep("Sign in", xtreamApiUrl(server, username, password, ""), userAgent);
  assertXtreamLogin(payload);
  return mapXtreamAccount(payload) as XtreamAccount;
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
  plot: string;
}

export interface IptvSeason {
  season: string;
  episodes: IptvEpisode[];
}

export interface IptvDetail {
  name: string;
  plot: string;
  rating: string;
  cast: string;
  cover: string;
  seasons: IptvSeason[];
}

export async function loadXtreamEpisodes(
  server: string,
  username: string,
  password: string,
  seriesId: number,
  userAgent?: string,
): Promise<IptvEpisode[]> {
  const info = (await fetchJsonStep(
    "Episodes",
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
        plot: String(row.plot ?? ""),
      });
    }
  }
  return rows;
}

export async function loadXtreamDetail(
  server: string,
  username: string,
  password: string,
  item: IptvEntry,
  userAgent?: string,
): Promise<IptvDetail> {
  if (item.kind === "movie") {
    const payload = await fetchJsonStep(
      "Movie",
      xtreamApiUrl(server, username, password, "get_vod_info", { vod_id: item.streamId }),
      userAgent,
    );
    const info = mapXtreamInfo(payload) as Omit<IptvDetail, "seasons">;
    return { ...info, seasons: [] };
  }
  if (item.kind === "series") {
    const payload = await fetchJsonStep(
      "Series",
      xtreamApiUrl(server, username, password, "get_series_info", { series_id: item.streamId }),
      userAgent,
    ) as { episodes?: Record<string, Array<Record<string, unknown>>> };
    const info = mapXtreamInfo(payload) as Omit<IptvDetail, "seasons">;
    const episodes = payload?.episodes && typeof payload.episodes === "object" ? payload.episodes : {};
    const seasons: IptvSeason[] = Object.entries(episodes).map(([season, list]) => ({
      season,
      episodes: Array.isArray(list)
        ? list.flatMap((row) => {
            const id = String(row.id ?? "");
            if (!id) return [];
            const episode = String(row.episode_num ?? "");
            const title = String(row.title ?? "");
            return [{
              id,
              name: `S${season.padStart(2, "0")}E${episode.padStart(2, "0")} ${title}`.trim(),
              url: xtreamEpisodeUrl(server, username, password, id, String(row.container_extension ?? "mp4")),
              plot: String(row.plot ?? ""),
            }];
          })
        : [],
    }));
    seasons.sort((left, right) => Number(left.season) - Number(right.season));
    return { ...info, seasons };
  }
  return { name: item.name, plot: "", rating: "", cast: "", cover: item.logo, seasons: [] };
}

export async function loadGuide(url: string, userAgent?: string) {
  const text = await readStep(url, userAgent, "Guide");
  return parseXmltv(text.slice(0, 2_000_000));
}
