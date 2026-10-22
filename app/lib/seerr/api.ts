/**
 * Seerr and Overseerr public API. Requests go to the viewer's own server.
 */

import { servarrFetch } from "@/lib/servarr/http";
import { asText } from "@/lib/own-server/http";

export async function testSeerr(baseUrl: string, apiKey: string): Promise<string> {
  const raw = await servarrFetch<Record<string, unknown>>(baseUrl, apiKey, "/api/v1/settings/public");
  return asText(raw.applicationTitle) || asText(raw.applicationUrl) || "Seerr";
}

export async function requestOnSeerr(
  baseUrl: string,
  apiKey: string,
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<void> {
  await servarrFetch(baseUrl, apiKey, "/api/v1/request", {
    method: "POST",
    body: {
      mediaType,
      mediaId: tmdbId,
      ...(mediaType === "tv" ? { seasons: "all" } : {}),
    },
  });
}
