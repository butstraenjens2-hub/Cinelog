/**
 * Playlist transport. On Android the native client streams the body to a file
 * and does not ask OkHttp for gzip. Elsewhere the JS fetch path is used.
 * Reports never include the request URL.
 */

import * as ReactNative from "react-native";

import { diagnoseM3u, diagnoseXtream, swapScheme } from "@/lib/iptv/diagnose.mjs";
import {
  effectiveUserAgent,
  exchangePlaylist,
  formatExchangeReport,
  formatStepError,
} from "@/lib/iptv/http.mjs";
import type { IptvEntry } from "@/lib/iptv/load";
import { kindFor } from "@/lib/iptv/m3u.mjs";
import { xtreamApiUrl } from "@/lib/iptv/xtream.mjs";

const { NativeModules, Platform } = ReactNative;

type NativeExchange = {
  ok?: boolean;
  status?: number;
  message?: string;
  path?: string;
  preview?: string;
  snippet?: string;
  contentType?: string;
  bytes?: number;
  scheme?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
};

type NativeRow = {
  id?: string;
  name?: string;
  group?: string;
  tvgId?: string;
  logo?: string;
  url?: string;
  kind?: string;
};

type NativeParse = {
  items?: NativeRow[];
  reason?: string;
  snippet?: string;
  bytes?: number;
};

export interface DownloadProgress {
  bytes: number;
  phase: string;
  count: number;
}

export interface NativePlaylist {
  items: IptvEntry[];
  status: number;
  contentType: string;
  bytes: number;
  snippet: string;
  reason: string;
  details: string[];
}

type IptvNative = {
  exchange: (url: string, userAgent: string) => Promise<NativeExchange>;
  readText: (path: string) => Promise<string>;
  parseM3u: (path: string) => Promise<NativeParse | NativeRow[]>;
  cancel?: () => Promise<boolean>;
};

type Emitter = {
  addListener: (name: string, listener: (event: DownloadProgress) => void) => { remove: () => void };
};

function nativeModule(): IptvNative | null {
  const candidate = NativeModules.IptvHttp as IptvNative | undefined;
  if (Platform.OS !== "android" || !candidate?.exchange) return null;
  return candidate;
}

function asEntry(row: NativeRow): IptvEntry | null {
  const url = String(row.url || "");
  if (!url) return null;
  const kind = row.kind === "movie" || row.kind === "series" ? row.kind : "live";
  return {
    id: String(row.id || url),
    name: String(row.name || "Channel"),
    group: String(row.group || ""),
    groupName: String(row.group || ""),
    tvgId: String(row.tvgId || ""),
    logo: String(row.logo || ""),
    url,
    kind,
    archiveHours: 0,
    streamId: 0,
    extension: "",
  };
}

function headerValue(headers: Record<string, string> | undefined, name: string) {
  const needle = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() === needle) return String(value || "");
  }
  return "";
}

async function nativeExchange(url: string, userAgent: string | undefined, step: string) {
  const native = nativeModule();
  if (!native) return null;
  const result = await native.exchange(url, effectiveUserAgent(userAgent));
  const exchange = {
    ok: Boolean(result.ok),
    status: Number(result.status || 0),
    body: String(result.preview || ""),
    requestHeaders: result.requestHeaders || {},
    responseHeaders: result.responseHeaders || {},
    scheme: String(result.scheme || ""),
  };
  if (!result.ok) {
    const error = new Error(formatStepError(step, exchange.status, result.message || ""));
    (error as Error & { exchange?: typeof exchange }).exchange = exchange;
    throw error;
  }
  return {
    exchange,
    path: String(result.path || ""),
    native,
    contentType: String(result.contentType || headerValue(result.responseHeaders, "content-type")),
    bytes: Number(result.bytes || 0),
    snippet: String(result.snippet || ""),
  };
}

export function subscribeDownload(listener: (event: DownloadProgress) => void) {
  const emitter = (ReactNative as { DeviceEventEmitter?: Emitter }).DeviceEventEmitter;
  if (!emitter?.addListener) return { remove() {} };
  return emitter.addListener("iptvDownloadProgress", listener);
}

export async function cancelDownload() {
  const native = nativeModule();
  if (native?.cancel) await native.cancel();
}

type VlcNative = {
  parsePlaylist: (url: string, userAgent: string) => Promise<{ items?: NativeRow[]; reason?: string }>;
  cancel?: () => Promise<boolean>;
};

function vlcModule(): VlcNative | null {
  const candidate = NativeModules.IptvVlc as VlcNative | undefined;
  if (Platform.OS !== "android" || !candidate?.parsePlaylist) return null;
  return candidate;
}

export async function cancelVlc() {
  const native = NativeModules.IptvVlc as VlcNative | undefined;
  if (native?.cancel) await native.cancel();
}

/** Opens the playlist with libVLC. Returns null when the library is not on this device. */
export async function parseWithVlc(
  url: string,
  userAgent: string | undefined,
): Promise<{ items: IptvEntry[]; reason: string } | null> {
  const native = vlcModule();
  if (!native) return null;
  const result = await native.parsePlaylist(url, effectiveUserAgent(userAgent));
  const items = (result?.items || []).flatMap((row) => {
    const location = String(row.url || "");
    if (!location.startsWith("http://") && !location.startsWith("https://")) return [];
    const kindName = kindFor(location, String(row.group || ""));
    const kind = kindName === "movie" || kindName === "series" ? kindName : "live";
    const entry: IptvEntry = {
      id: String(row.id || location),
      name: String(row.name || "Channel"),
      group: String(row.group || ""),
      groupName: String(row.group || ""),
      tvgId: String(row.tvgId || ""),
      logo: String(row.logo || ""),
      url: location,
      kind,
      archiveHours: 0,
      streamId: 0,
      extension: "",
    };
    return [entry];
  });
  return { items, reason: String(result?.reason || "") };
}

export async function readStep(url: string, userAgent: string | undefined, step: string): Promise<string> {
  const hit = await nativeExchange(url, userAgent, step);
  if (!hit) return exchangePlaylist(url, { userAgent, step }).then((exchange) => exchange.body);
  if (!hit.path) return hit.exchange.body;
  return hit.native.readText(hit.path);
}

export async function readM3uEntries(url: string, userAgent: string | undefined): Promise<NativePlaylist | null> {
  const hit = await nativeExchange(url, userAgent, "Playlist");
  if (!hit) return null;
  const parsed = hit.path ? await hit.native.parseM3u(hit.path) : [];
  const rows = Array.isArray(parsed) ? parsed : parsed.items || [];
  const items = rows.flatMap((row) => {
    const entry = asEntry(row);
    return entry ? [entry] : [];
  });
  const snippet = String((!Array.isArray(parsed) && parsed.snippet) || hit.snippet || "");
  const bytes = Number((!Array.isArray(parsed) && parsed.bytes) || hit.bytes || 0);
  let reason = !Array.isArray(parsed) ? String(parsed.reason || "") : "";
  if (!items.length && !reason) {
    if (!bytes) reason = "empty body";
    else if (snippet === "gzip binary" || snippet === "binary") reason = snippet;
    else if (snippet.startsWith("#EXTM3U") || snippet.startsWith("HTML")) reason = snippet.startsWith("#EXTM3U") ? "no channel lines" : "HTML login page";
    else reason = "not #EXTM3U";
  }
  const contentType = hit.contentType.split(";")[0].trim();
  const details = [
    hit.exchange.status ? `HTTP ${hit.exchange.status}` : "",
    contentType ? `Content-Type: ${contentType}` : "",
    `Bytes: ${bytes}`,
    reason ? `Cause: ${reason}` : "",
    snippet ? `Preview: ${snippet}` : "",
    ...formatExchangeReport(hit.exchange),
  ].filter(Boolean);
  return {
    items,
    status: hit.exchange.status,
    contentType,
    bytes,
    snippet,
    reason: items.length ? "" : reason,
    details,
  };
}

function failureLines(error: unknown): string[] {
  const message = error instanceof Error ? error.message : "The request failed.";
  const exchange = (error as { exchange?: Parameters<typeof formatExchangeReport>[0] })?.exchange;
  return exchange ? [message, ...formatExchangeReport(exchange)] : [message];
}

export async function reportM3u(url: string, userAgent?: string): Promise<string[]> {
  if (!nativeModule()) return diagnoseM3u({ url, userAgent });
  try {
    const hit = await nativeExchange(url, userAgent, "Playlist");
    if (!hit) return diagnoseM3u({ url, userAgent });
    const preview = hit.snippet || hit.exchange.body;
    const line = preview.includes("#EXTM3U")
      ? "Playlist: OK"
      : `Playlist: OK, but the file is not an M3U playlist.${preview ? ` ${preview}` : ""}`;
    return [`User agent: ${effectiveUserAgent(userAgent)}`, line, ...formatExchangeReport(hit.exchange)];
  } catch (error) {
    const lines = [`User agent: ${effectiveUserAgent(userAgent)}`, ...failureLines(error)];
    const alt = swapScheme(url);
    if (!alt) return lines;
    const label = alt.startsWith("https:") ? "https" : "http";
    try {
      const retry = await nativeExchange(alt, userAgent, "Playlist");
      if (retry) lines.push(`Playlist over ${label}: OK. Save the playlist with that address.`, ...formatExchangeReport(retry.exchange));
    } catch (altError) {
      const message = altError instanceof Error ? altError.message : "failed";
      lines.push(message.replace(/^Playlist/, `Playlist over ${label}`));
    }
    return lines;
  }
}

export async function reportXtream(input: {
  server: string;
  username: string;
  password: string;
  userAgent?: string;
}): Promise<string[]> {
  if (!nativeModule()) return diagnoseXtream(input);
  const agent = effectiveUserAgent(input.userAgent);
  const lines = [`User agent: ${agent}`];
  try {
    const hit = await nativeExchange(
      xtreamApiUrl(input.server, input.username, input.password, ""),
      agent,
      "Sign in",
    );
    if (!hit) return diagnoseXtream(input);
    lines.push("Sign in: OK", ...formatExchangeReport(hit.exchange));
  } catch (error) {
    lines.push(...failureLines(error));
    const alt = swapScheme(input.server);
    if (alt) {
      const label = alt.startsWith("https:") ? "https" : "http";
      try {
        const retry = await nativeExchange(
          xtreamApiUrl(alt, input.username, input.password, ""),
          agent,
          "Sign in",
        );
        if (retry) {
          lines.push(`Sign in over ${label}: OK. Save the server with that address.`, ...formatExchangeReport(retry.exchange));
        }
      } catch (altError) {
        const message = altError instanceof Error ? altError.message : "failed";
        lines.push(message.replace(/^Sign in/, `Sign in over ${label}`));
      }
    }
    return lines;
  }
  try {
    const hit = await nativeExchange(
      xtreamApiUrl(input.server, input.username, input.password, "get_live_categories"),
      agent,
      "Live categories",
    );
    if (hit) lines.push("Live categories: OK", ...formatExchangeReport(hit.exchange));
  } catch (error) {
    lines.push(...failureLines(error));
  }
  return lines;
}
