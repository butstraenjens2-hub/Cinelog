/**
 * HTTP helper for a server the viewer configured.
 * Callers attach secrets as headers. This helper does not put them in the URL.
 */

import { joinApi, normalizeServerUrl } from "@/lib/servarr/url.mjs";

export class OwnServerError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "OwnServerError";
    this.status = status;
  }
}

export async function ownFetch<T>(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    form?: Record<string, string>;
    query?: Record<string, string | number | boolean | undefined>;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : joinApi(baseUrl, path));
  for (const [name, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(name, String(value));
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "CineLog/1.0.35",
    ...options.headers,
  };
  let body: string | undefined;
  if (options.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(options.form).toString();
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  try {
    const response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      let detail = "";
      try {
        const payload = (await response.json()) as { message?: string; error?: string; ErrorMessage?: string };
        detail = String(payload?.message || payload?.ErrorMessage || payload?.error || "");
      } catch {
        detail = "";
      }
      throw new OwnServerError(response.status, detail || `Server returned ${response.status}.`);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof OwnServerError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new OwnServerError(0, "The server took too long to respond.");
    }
    throw new OwnServerError(
      0,
      "Could not reach the server. Check the URL and that this device can access it.",
    );
  } finally {
    clearTimeout(timer);
  }
}

export function serverOrigin(input: string): string {
  return normalizeServerUrl(input);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function asText(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
