export function simklBucket(status: string): "watchlist" | "progress" | null;

export function simklTitle(row: unknown): {
  tmdbId: number;
  title: string;
  year: number | null;
  status: string;
  seasons: unknown[];
};
