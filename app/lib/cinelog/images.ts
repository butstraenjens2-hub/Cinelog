/**
 * CineLog — display-sized TMDB artwork.
 *
 * Detail payloads carry large TMDB renditions (w500/w780/w1280). Cards render
 * far smaller, so requesting the full image wastes bandwidth, decode time and
 * memory. These helpers rewrite a TMDB image URL to the smallest rendition that
 * still covers the on-screen size at the device pixel ratio. Non-TMDB URLs are
 * returned untouched.
 */

import { PixelRatio } from "react-native";

const TMDB_SIZE_RE = /^(https:\/\/image\.tmdb\.org\/t\/p\/)(w\d+|h\d+|original)(\/.+)$/;

const POSTER_WIDTHS = [92, 154, 185, 342, 500, 780] as const;
const STILL_WIDTHS = [300, 780, 1280] as const;
const PROFILE_WIDTHS = [45, 185] as const;

export type ArtworkKind = "poster" | "still" | "profile";

function pick(widths: readonly number[], target: number): number {
  for (const width of widths) if (width >= target) return width;
  return widths[widths.length - 1];
}

/** Rewrite a TMDB URL to the rendition that best fits `displayWidth` points. */
export function sizedTmdbImage(
  url: string | null | undefined,
  displayWidth: number,
  kind: ArtworkKind = "poster",
): string | undefined {
  if (!url) return undefined;
  const match = TMDB_SIZE_RE.exec(url);
  if (!match) return url;
  const target = Math.ceil(displayWidth * Math.min(PixelRatio.get(), 3));
  const widths =
    kind === "still" ? STILL_WIDTHS : kind === "profile" ? PROFILE_WIDTHS : POSTER_WIDTHS;
  const chosen = kind === "profile" && target > 185 ? "h632" : `w${pick(widths, target)}`;
  return `${match[1]}${chosen}${match[3]}`;
}

/** Tiny rendition shown while the real artwork loads. */
export function tmdbPlaceholder(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const match = TMDB_SIZE_RE.exec(url);
  return match ? `${match[1]}w92${match[3]}` : undefined;
}
