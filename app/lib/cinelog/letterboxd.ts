/**
 * CineLog — Letterboxd CSV import.
 *
 * Letterboxd's data export (Settings → Import & Export) is a zip with
 * `watched.csv`, `ratings.csv`, `diary.csv` and `watchlist.csv`. Each row has at
 * least `Date, Name, Year` (+ `Rating` 0.5–5 for ratings/diary). We parse any of
 * those files, match each film on TMDB by title + year, and map:
 *   watched/diary → watched (keeping the original date)
 *   ratings       → rating ×2 (Letterboxd is out of 5, CineLog out of 10)
 *   watchlist     → watchlist
 */

import { searchMedia } from "@/lib/cinelog/api";
import type { MediaSummary } from "@/lib/cinelog/types";

export type LetterboxdKind = "watched" | "ratings" | "watchlist";

export interface LetterboxdRow {
  name: string;
  year: number | null;
  date: string | null;
  /** 1–10 after conversion, when the file has ratings. */
  score: number | null;
}

export interface ParsedLetterboxd {
  kind: LetterboxdKind;
  rows: LetterboxdRow[];
}

/** RFC 4180-ish CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

export function parseLetterboxd(text: string, fileName = ""): ParsedLetterboxd {
  const [header, ...body] = parseCsv(text);
  if (!header) throw new Error("empty");
  const columns = header.map((h) => h.trim().toLowerCase());
  const col = (name: string) => columns.indexOf(name);
  const nameIdx = col("name");
  if (nameIdx < 0) throw new Error("not-letterboxd");
  const yearIdx = col("year");
  const ratingIdx = col("rating");
  const dateIdx = col("watched date") >= 0 ? col("watched date") : col("date");

  const lower = fileName.toLowerCase();
  const kind: LetterboxdKind = lower.includes("watchlist")
    ? "watchlist"
    : ratingIdx >= 0 && !lower.includes("diary") && !lower.includes("watched")
      ? "ratings"
      : "watched";

  const rows = body
    .map((cells): LetterboxdRow | null => {
      const name = (cells[nameIdx] ?? "").trim();
      if (!name) return null;
      const year = Number.parseInt(cells[yearIdx] ?? "", 10);
      const rating = Number.parseFloat(cells[ratingIdx] ?? "");
      const date = (cells[dateIdx] ?? "").trim();
      return {
        name,
        year: Number.isFinite(year) ? year : null,
        date: /^\d{4}-\d{2}-\d{2}/.test(date) ? date : null,
        score:
          Number.isFinite(rating) && rating > 0
            ? Math.min(10, Math.max(1, Math.round(rating * 2)))
            : null,
      };
    })
    .filter((row): row is LetterboxdRow => row !== null);
  return { kind, rows };
}

function normalise(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Best TMDB movie match for a Letterboxd row, or null. */
export async function matchLetterboxdRow(
  row: LetterboxdRow,
): Promise<MediaSummary | null> {
  const results = await searchMedia(row.name);
  const movies = results.movies;
  if (movies.length === 0) return null;
  const wanted = normalise(row.name);
  const scored = movies
    .map((movie) => {
      let score = 0;
      if (normalise(movie.title) === wanted) score += 3;
      if (row.year && movie.year) {
        const diff = Math.abs(movie.year - row.year);
        score += diff === 0 ? 3 : diff === 1 ? 1 : -3;
      }
      return { movie, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0].score >= 2 ? scored[0].movie : null;
}

/** Run `worker` over `items` with limited concurrency, reporting progress. */
export async function mapLimited<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
  onProgress?: (done: number) => void,
  shouldStop?: () => boolean,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  const run = async () => {
    while (next < items.length && !shouldStop?.()) {
      const index = next;
      next += 1;
      out[index] = await worker(items[index]);
      done += 1;
      onProgress?.(done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}
