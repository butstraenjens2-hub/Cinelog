/** Which local list a SIMKL watchlist status should update. */

export function simklBucket(status) {
  const value = String(status ?? "").toLowerCase();
  if (value === "plantowatch") return "watchlist";
  if (value === "completed" || value === "watching") return "progress";
  return null;
}

export function simklTitle(row) {
  const source = row && typeof row === "object" ? row : {};
  const nested = source.movie || source.show || source;
  const ids = nested.ids && typeof nested.ids === "object" ? nested.ids : {};
  const tmdbId = Number(ids.tmdb || source.tmdb || 0);
  return {
    tmdbId: Number.isFinite(tmdbId) ? tmdbId : 0,
    title: typeof nested.title === "string" ? nested.title : "",
    year: Number(nested.year) || null,
    status: typeof source.status === "string" ? source.status : "",
    seasons: Array.isArray(source.seasons) ? source.seasons : [],
  };
}
