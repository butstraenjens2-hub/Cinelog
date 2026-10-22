/**
 * HTTP client for a viewer's own Sonarr or Radarr v3 API.
 * The API key is sent as a header and is never written into the URL.
 */

import { joinApi } from "@/lib/servarr/url.mjs";

export class ServarrError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ServarrError";
    this.status = status;
  }
}

export interface ServarrRequest {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

export async function servarrFetch<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  options: ServarrRequest = {},
): Promise<T> {
  const key = apiKey.trim();
  if (!key) throw new ServarrError(0, "API key is required.");

  const url = new URL(joinApi(baseUrl, path));
  for (const [name, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(name, String(value));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": key,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = "";
      try {
        const payload = (await response.json()) as { message?: string; title?: string };
        detail = String(payload?.message || payload?.title || "");
      } catch {
        detail = "";
      }
      throw new ServarrError(
        response.status,
        detail || `Server returned ${response.status}.`,
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ServarrError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ServarrError(0, "The server took too long to respond.");
    }
    throw new ServarrError(
      0,
      "Could not reach the server. Check the URL and that this device can access it.",
    );
  } finally {
    clearTimeout(timer);
  }
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

export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
