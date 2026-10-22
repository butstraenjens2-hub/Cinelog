/**
 * Read-only Tautulli API for the viewer's own server.
 * Tautulli only accepts the key as the `apikey` query parameter.
 */

import { asNumber, asRecord, asText, ownFetch } from "@/lib/own-server/http";

export interface TautulliRow {
  id: string;
  title: string;
  meta: string;
}

async function tautulli<T>(baseUrl: string, apiKey: string, cmd: string, query: Record<string, string | number> = {}): Promise<T> {
  const raw = await ownFetch<Record<string, unknown>>(baseUrl, "/api/v2", {
    query: { apikey: apiKey.trim(), cmd, ...query },
  });
  const response = asRecord(raw.response);
  if (asText(response.result) && asText(response.result) !== "success") {
    throw new Error(asText(response.message) || "Tautulli refused the request.");
  }
  return response.data as T;
}

export async function testTautulli(baseUrl: string, apiKey: string): Promise<string> {
  const data = await tautulli<Record<string, unknown>>(baseUrl, apiKey, "get_server_info");
  return asText(data.pms_name) || asText(data.pms_version) || "Tautulli";
}

export async function tautulliActivity(baseUrl: string, apiKey: string): Promise<TautulliRow[]> {
  const data = await tautulli<Record<string, unknown>>(baseUrl, apiKey, "get_activity");
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  return sessions.map((row, index) => {
    const raw = asRecord(row);
    return {
      id: asText(raw.session_key) || String(index),
      title: asText(raw.full_title) || asText(raw.title) || "Session",
      meta: `${asText(raw.friendly_name) || "Someone"} · ${asText(raw.state) || "playing"}`,
    };
  });
}

export async function tautulliStats(baseUrl: string, apiKey: string): Promise<TautulliRow[]> {
  const data = await tautulli<unknown[]>(baseUrl, apiKey, "get_home_stats", { time_range: 30, stats_count: 5 });
  const groups = Array.isArray(data) ? data : [];
  const rows: TautulliRow[] = [];
  for (const group of groups) {
    const raw = asRecord(group);
    const stat = asText(raw.stat_title) || asText(raw.stat_id);
    const items = Array.isArray(raw.rows) ? raw.rows : [];
    for (const item of items.slice(0, 3)) {
      const row = asRecord(item);
      rows.push({
        id: `${stat}-${asText(row.title)}-${rows.length}`,
        title: asText(row.title) || asText(row.grandparent_title) || "Title",
        meta: stat,
      });
    }
  }
  return rows.slice(0, 12);
}

export async function tautulliStop(baseUrl: string, apiKey: string, sessionKey: string): Promise<void> {
  await tautulli(baseUrl, apiKey, "terminate_session", { session_key: sessionKey });
}

export async function tautulliHistory(baseUrl: string, apiKey: string): Promise<TautulliRow[]> {
  const data = await tautulli<Record<string, unknown>>(baseUrl, apiKey, "get_history", { length: 20 });
  const records = Array.isArray(data.data) ? data.data : [];
  return records.map((row, index) => {
    const raw = asRecord(row);
    return {
      id: String(asNumber(raw.id) || index),
      title: asText(raw.full_title) || asText(raw.title) || "Play",
      meta: asText(raw.friendly_name) || asText(raw.user) || "",
    };
  });
}
