/**
 * Nexora – Media API Routes (v2)
 *
 * Clean Express Router for all movie/series endpoints.
 * Uses TMDB as the canonical source; normalized canonical responses.
 * Never passes raw TMDB shapes to the client.
 *
 * Mounts at: /api/media (registered in index.js)
 */

import { Router } from "express";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { safeFetchJson } from "../shared/fetcher.js";
import { cache, TTL } from "../shared/cache.js";
import { ok, err, empty, send } from "../shared/response.js";
import { createLogger } from "../shared/logger.js";
import { fetchOmdbRatings } from "./omdb.js";

// Ensure .env is loaded even if this module is evaluated before dotenv.config()
// runs in the parent (index.js imports are hoisted before dotenv.config() is called)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const log = createLogger("media");
const router = Router();

// ─── TMDB Config ──────────────────────────────────────────────────────────────
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";
const TMDB_TIMEOUT_MS = Number(process.env.TMDB_TIMEOUT_MS || 8_000);

function getTmdbKey() {
  return String(process.env.TMDB_API_KEY || "").trim();
}

function isTmdbAvailable() {
  return Boolean(getTmdbKey());
}

function tmdbUrl(path, params = {}) {
  const q = new URLSearchParams({ api_key: getTmdbKey(), ...params });
  return `${TMDB_BASE}${path}?${q}`;
}

function imgUrl(path, size = "w500") {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${TMDB_IMG}/${size}${path}`;
}

async function tmdb(path, params = {}, label = "tmdb") {
  if (!isTmdbAvailable()) throw new Error("TMDB_API_KEY not configured");
  return safeFetchJson(tmdbUrl(path, params), {
    timeoutMs: TMDB_TIMEOUT_MS,
    source: label,
    retries: 1,
  });
}

function checkTmdb(res) {
  if (!isTmdbAvailable()) {
    return send(
      res,
      err(
        "TMDB_NOT_CONFIGURED",
        "Media API key is not configured. Set TMDB_API_KEY.",
        { source: "tmdb" },
      ),
      503,
    );
  }
  return null;
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeMovie(item, omdbData = null) {
  const base = {
    id: item.id,
    type: "movie",
    title: item.title ?? item.original_title ?? null,
    overview: item.overview ?? null,
    releaseDate: item.release_date ?? null,
    year: item.release_date ? parseInt(item.release_date, 10) : null,
    runtime: item.runtime ?? null,
    poster: imgUrl(item.poster_path, "w780"),
    backdrop: imgUrl(item.backdrop_path, "w1280"),
    genres: (item.genres ?? item.genre_ids ?? []).map((g) =>
      typeof g === "object" ? g.name : g,
    ),
    rating: item.vote_average ?? null,
    voteCount: item.vote_count ?? null,
    popularity: item.popularity ?? null,
    language: item.original_language ?? null,
    status: item.status ?? null,
    tagline: item.tagline ?? null,
    budget: item.budget ?? null,
    revenue: item.revenue ?? null,
    imdbId: item.imdb_id ?? null,
    collectionId: item.belongs_to_collection?.id ?? null,
    collection: item.belongs_to_collection
      ? {
          id: item.belongs_to_collection.id,
          name: item.belongs_to_collection.name ?? "",
          poster: imgUrl(item.belongs_to_collection.poster_path, "w500"),
        }
      : null,
    companies: (item.production_companies ?? [])
      .map((company) => ({
        id: company.id,
        name: company.name ?? "",
        logo: imgUrl(company.logo_path, "w185"),
      }))
      .filter((company) => company.id && company.name),
    source: "tmdb",
  };

  // Merge OMDB ratings if available
  if (omdbData) {
    base.imdbRating = omdbData.imdbRating ?? null;
    base.imdbVotes = omdbData.imdbVotes ?? null;
    base.rottenTomatoesRating = omdbData.rottenTomatoesRating ?? null;
    base.metacriticScore = omdbData.metacriticScore ?? null;
    if (omdbData.imdbId) base.imdbId = omdbData.imdbId;
  }

  return base;
}

function normalizeSeries(item, omdbData = null) {
  const base = {
    id: item.id,
    type: "series",
    title: item.name ?? item.original_name ?? null,
    overview: item.overview ?? null,
    firstAirDate: item.first_air_date ?? null,
    lastAirDate: item.last_air_date ?? null,
    year: item.first_air_date ? parseInt(item.first_air_date, 10) : null,
    status: item.status ?? null,
    poster: imgUrl(item.poster_path, "w780"),
    backdrop: imgUrl(item.backdrop_path, "w1280"),
    genres: (item.genres ?? item.genre_ids ?? []).map((g) =>
      typeof g === "object" ? g.name : g,
    ),
    rating: item.vote_average ?? null,
    voteCount: item.vote_count ?? null,
    popularity: item.popularity ?? null,
    language: item.original_language ?? null,
    episodeCount: item.number_of_episodes ?? null,
    seasonCount: item.number_of_seasons ?? null,
    seasons: (item.seasons ?? []).map((s) => ({
      seasonNumber: s.season_number,
      episodeCount: s.episode_count,
      airDate: s.air_date ?? null,
      poster: imgUrl(s.poster_path, "w500"),
      name: s.name ?? `Season ${s.season_number}`,
    })),
    networks: (item.networks ?? []).map((n) => n.name),
    networkRefs: (item.networks ?? [])
      .map((network) => ({
        id: network.id,
        name: network.name ?? "",
        logo: imgUrl(network.logo_path, "w185"),
      }))
      .filter((network) => network.id && network.name),
    nextEpisodeToAir: item.next_episode_to_air
      ? {
          airDate: item.next_episode_to_air.air_date ?? null,
          seasonNumber: item.next_episode_to_air.season_number ?? null,
          episodeNumber: item.next_episode_to_air.episode_number ?? null,
          name: item.next_episode_to_air.name ?? null,
        }
      : null,
    source: "tmdb",
  };

  // Merge OMDB ratings if available
  if (omdbData) {
    base.imdbRating = omdbData.imdbRating ?? null;
    base.imdbVotes = omdbData.imdbVotes ?? null;
    base.rottenTomatoesRating = omdbData.rottenTomatoesRating ?? null;
    base.metacriticScore = omdbData.metacriticScore ?? null;
    if (omdbData.imdbId) base.imdbId = omdbData.imdbId;
  }

  return base;
}

function normalizeCastMember(c) {
  return {
    id: c.id,
    name: c.name ?? null,
    character: c.character ?? c.roles?.[0]?.character ?? null,
    photo: imgUrl(c.profile_path, "w185"),
    order: c.order ?? null,
    department: c.known_for_department ?? null,
  };
}

function normalizeTrailer(v) {
  if (v.site === "YouTube") {
    return {
      key: v.key,
      url: `https://www.youtube.com/watch?v=${v.key}`,
      name: v.name,
      type: v.type,
      official: v.official ?? false,
    };
  }
  return null;
}

function normalizePersonKnownForItem(item) {
  if (!item) return null;
  const mediaType =
    item.media_type === "tv" || item.first_air_date ? "series" : "movie";
  return {
    id: item.id,
    type: mediaType,
    title: item.title ?? item.name ?? null,
    overview: item.overview ? item.overview.slice(0, 200) : null,
    poster: imgUrl(item.poster_path, "w780"),
    backdrop: imgUrl(item.backdrop_path, "w1280"),
    year: (item.release_date ?? item.first_air_date ?? "").slice(0, 4) || null,
    releaseDate: item.release_date ?? null,
    firstAirDate: item.first_air_date ?? null,
    rating: item.vote_average ?? null,
    popularity: item.popularity ?? null,
    source: "tmdb",
  };
}

// ─── List Normalizer ──────────────────────────────────────────────────────────
function normalizeListItem(item) {
  // Exclude people — they have no streamable content and their TMDB numeric
  // ID overlaps with movie/TV IDs causing "not found" errors on the detail page.
  if (item.media_type === "person") return null;
  const isMovie = item.media_type === "movie" || !!item.title;
  return {
    id: item.id,
    type: isMovie ? "movie" : "series",
    title: item.title ?? item.name ?? null,
    overview: item.overview ? item.overview.slice(0, 200) : null,
    poster: imgUrl(item.poster_path, "w780"),
    backdrop: imgUrl(item.backdrop_path, "w1280"),
    year: (item.release_date ?? item.first_air_date ?? "").slice(0, 4) || null,
    releaseDate: item.release_date ?? null,
    firstAirDate: item.first_air_date ?? null,
    rating: item.vote_average ?? null,
    genres: item.genre_ids ?? [],
    popularity: item.popularity ?? null,
    source: "tmdb",
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/media/home
 * Aggregated home feed: trending + new movies + new series.
 */
router.get("/home", async (req, res) => {
  const gate = checkTmdb(res);
  if (gate) return gate;

  const key = "media_v2_home";

  try {
    const { value, isCached } = await cache.getOrFetch(
      key,
      TTL.HOMEPAGE,
      async () => {
        const [moviesRes, seriesRes, trendingRes] = await Promise.allSettled([
          tmdb("/trending/movie/week", {}, "tmdb:trending-movies"),
          tmdb("/trending/tv/week", {}, "tmdb:trending-series"),
          tmdb("/trending/all/week", {}, "tmdb:trending-all"),
        ]);

        const movies = (
          moviesRes.status === "fulfilled"
            ? (moviesRes.value?.results ?? [])
            : []
        )
          .slice(0, 20)
          .map(normalizeListItem)
          .filter(Boolean);
        const series = (
          seriesRes.status === "fulfilled"
            ? (seriesRes.value?.results ?? [])
            : []
        )
          .slice(0, 20)
          .map(normalizeListItem)
          .filter(Boolean);
        const trending = (
          trendingRes.status === "fulfilled"
            ? (trendingRes.value?.results ?? [])
            : []
        )
          .slice(0, 10)
          .map(normalizeListItem)
          .filter(Boolean);

        return { trending, movies, series };
      },
    );

    return send(res, ok(value, { source: "tmdb", isCached }));
  } catch (e) {
    log.error("media home error", { message: e.message });
    return send(
      res,
      err("MEDIA_HOME_UNAVAILABLE", "Media home feed unavailable", {
        source: "tmdb",
      }),
      503,
    );
  }
});

/**
 * GET /api/media/movies?page=1&genre=28&sort=popularity.desc&from_year=1950&to_year=2024&company_id=2
 * Paginated movie catalog.
 */
router.get("/movies", async (req, res) => {
  const gate = checkTmdb(res);
  if (gate) return gate;

  const page = Math.min(Math.max(Number(req.query.page || 1), 1), 500);
  const genre = req.query.genre ? String(req.query.genre) : null;
  const sort = String(req.query.sort || "popularity.desc");
  const fromYear = req.query.from_year ? String(req.query.from_year) : null;
  const toYear = req.query.to_year ? String(req.query.to_year) : null;
  const companyId = req.query.company_id ? String(req.query.company_id) : null;
  const watchRegionRaw = String(req.query.watch_region || "").toUpperCase();
  const watchRegion = /^[A-Z]{2}$/.test(watchRegionRaw) ? watchRegionRaw : null;
  const monetization = req.query.monetization
    ? String(req.query.monetization)
    : null;
  const key = `media_v2_movies_${page}_${genre ?? "any"}_${sort}_${fromYear ?? ""}_${toYear ?? ""}_${companyId ?? ""}_${watchRegion ?? ""}_${monetization ?? ""}`;

  try {
    const { value, isCached } = await cache.getOrFetch(
      key,
      TTL.CATALOG,
      async () => {
        const params = {
          page,
          sort_by: sort,
          ...(genre ? { with_genres: genre } : {}),
          ...(fromYear
            ? { "primary_release_date.gte": `${fromYear}-01-01` }
            : {}),
          ...(toYear ? { "primary_release_date.lte": `${toYear}-12-31` } : {}),
          ...(companyId ? { with_companies: companyId } : {}),
          ...(watchRegion
            ? {
                watch_region: watchRegion,
                with_watch_monetization_types:
                  monetization || "flatrate|free|ads",
                "vote_count.gte": "50",
              }
            : {}),
        };
        const data = await tmdb("/discover/movie", params, "tmdb:movies");
        return {
          page: data.page,
          total_pages: Math.min(data.total_pages ?? 1, 500),
          total_results: data.total_results ?? 0,
          results: (data.results ?? []).map(normalizeListItem).filter(Boolean),
        };
      },
    );

    return send(res, ok(value, { source: "tmdb", isCached }));
  } catch (e) {
    log.error("movies catalog error", { message: e.message });
    return send(
      res,
      err("MEDIA_CATALOG_UNAVAILABLE", "Movie catalog unavailable", {
        source: "tmdb",
      }),
      503,
    );
  }
});

/**
 * GET /api/media/series?page=1&genre=18&network_id=13
 * Paginated series catalog.
 */
router.get("/series", async (req, res) => {
  const gate = checkTmdb(res);
  if (gate) return gate;

  const page = Math.min(Math.max(Number(req.query.page || 1), 1), 500);
  const genre = req.query.genre ? String(req.query.genre) : null;
  const sort = String(req.query.sort || "popularity.desc");
  const networkId = req.query.network_id ? String(req.query.network_id) : null;
  const feed = ["airing_today", "on_the_air"].includes(String(req.query.feed))
    ? String(req.query.feed)
    : "";
  const key = `media_v2_series_${page}_${genre ?? "any"}_${sort}_${networkId ?? ""}_${feed}`;

  try {
    const { value, isCached } = await cache.getOrFetch(
      key,
      TTL.CATALOG,
      async () => {
        const params = {
          page,
          sort_by: sort,
          ...(genre ? { with_genres: genre } : {}),
          ...(networkId ? { with_networks: networkId } : {}),
        };
        const data = feed
          ? await tmdb(`/tv/${feed}`, { page }, `tmdb:${feed}`)
          : await tmdb("/discover/tv", params, "tmdb:series");
        return {
          page: data.page,
          total_pages: Math.min(data.total_pages ?? 1, 500),
          total_results: data.total_results ?? 0,
          results: (data.results ?? []).map(normalizeListItem).filter(Boolean),
        };
      },
    );

    return send(res, ok(value, { source: "tmdb", isCached }));
  } catch (e) {
    log.error("series catalog error", { message: e.message });
    return send(
      res,
      err("MEDIA_CATALOG_UNAVAILABLE", "Series catalog unavailable", {
        source: "tmdb",
      }),
      503,
    );
  }
});

/**
 * GET /api/media/movie/:id
 * Full movie detail.
 */
router.get("/movie/:id", async (req, res) => {
  const gate = checkTmdb(res);
  if (gate) return gate;

  const id = parseInt(req.params.id, 10);
  if (!id || id < 1)
    return send(
      res,
      err("INVALID_ID", "Invalid movie ID", { source: "tmdb" }),
      400,
    );

  const key = `media_v2_movie_${id}`;

  try {
    const { value, isCached } = await cache.getOrFetch(
      key,
      TTL.MEDIA_DETAIL,
      async () => {
        const data = await tmdb(
          `/movie/${id}`,
          { append_to_response: "credits,videos,recommendations,similar" },
          "tmdb:movie-detail",
        );

        // Fetch OMDB ratings asynchronously (don't block main response)
        const omdbData = await fetchOmdbRatings(
          data.title,
          data.release_date ? parseInt(data.release_date, 10) : null,
          "movie",
          data.imdb_id,
        );

        const movie = normalizeMovie(data, omdbData);
        movie.cast = (data.credits?.cast ?? [])
          .slice(0, 30)
          .map(normalizeCastMember);
        movie.crew = (data.credits?.crew ?? [])
          .filter((c) => ["Director", "Producer", "Writer"].includes(c.job))
          .slice(0, 15)
          .map((c) => ({
            id: c.id,
            name: c.name,
            job: c.job,
            photo: imgUrl(c.profile_path, "w185"),
          }));
        movie.trailers = (data.videos?.results ?? [])
          .filter((v) => v.type === "Trailer")
          .map(normalizeTrailer)
          .filter(Boolean)
          .slice(0, 3);
        movie.recommendations = (data.recommendations?.results ?? [])
          .slice(0, 12)
          .map(normalizeListItem)
          .filter(Boolean);
        movie.similar = (data.similar?.results ?? [])
          .slice(0, 12)
          .map(normalizeListItem)
          .filter(Boolean);
        return movie;
      },
    );

    return send(res, ok(value, { source: "tmdb", isCached }));
  } catch (e) {
    if (e.message?.includes("404") || e.status === 404) {
      return send(
        res,
        err("MOVIE_NOT_FOUND", `Movie ${id} not found`, { source: "tmdb" }),
        404,
      );
    }
    log.error("movie detail error", { id, message: e.message });
    return send(
      res,
      err("MOVIE_UNAVAILABLE", "Movie detail unavailable", { source: "tmdb" }),
      503,
    );
  }
});

/**
 * GET /api/media/series/:id
 * Full series detail.
 */
router.get("/series/:id", async (req, res) => {
  const gate = checkTmdb(res);
  if (gate) return gate;

  const id = parseInt(req.params.id, 10);
  if (!id || id < 1)
    return send(
      res,
      err("INVALID_ID", "Invalid series ID", { source: "tmdb" }),
      400,
    );

  const key = `media_v2_series_${id}`;

  try {
    const { value, isCached } = await cache.getOrFetch(
      key,
      TTL.MEDIA_DETAIL,
      async () => {
        const data = await tmdb(
          `/tv/${id}`,
          {
            append_to_response:
              "credits,videos,recommendations,similar,aggregate_credits",
          },
          "tmdb:series-detail",
        );

        // Fetch OMDB ratings asynchronously
        const omdbData = await fetchOmdbRatings(
          data.name,
          data.first_air_date ? parseInt(data.first_air_date, 10) : null,
          "series",
        );

        const series = normalizeSeries(data, omdbData);
        const castSource = data.aggregate_credits ?? data.credits;
        series.cast = (castSource?.cast ?? [])
          .slice(0, 30)
          .map(normalizeCastMember);
        series.trailers = (data.videos?.results ?? [])
          .filter((v) => v.type === "Trailer")
          .map(normalizeTrailer)
          .filter(Boolean)
          .slice(0, 3);
        series.recommendations = (data.recommendations?.results ?? [])
          .slice(0, 12)
          .map(normalizeListItem)
          .filter(Boolean);
        series.similar = (data.similar?.results ?? [])
          .slice(0, 12)
          .map(normalizeListItem)
          .filter(Boolean);
        return series;
      },
    );

    return send(res, ok(value, { source: "tmdb", isCached }));
  } catch (e) {
    if (e.status === 404 || e.message?.includes("404")) {
      return send(
        res,
        err("SERIES_NOT_FOUND", `Series ${id} not found`, { source: "tmdb" }),
        404,
      );
    }
    log.error("series detail error", { id, message: e.message });
    return send(
      res,
      err("SERIES_UNAVAILABLE", "Series detail unavailable", {
        source: "tmdb",
      }),
      503,
    );
  }
});

/**
 * GET /api/media/search?q=...&type=movie|series|all&page=1
 * Unified media search.
 */
router.get("/search", async (req, res) => {
  const gate = checkTmdb(res);
  if (gate) return gate;

  const q = String(req.query.q || "").trim();
  const type = String(req.query.type || "all");
  const page = Math.max(Number(req.query.page || 1), 1);
  const year = /^\d{4}$/.test(String(req.query.year || ""))
    ? String(req.query.year)
    : "";

  if (!q)
    return send(
      res,
      err("MISSING_QUERY", "Query parameter 'q' is required", {
        source: "tmdb",
      }),
      400,
    );
  if (q.length < 2)
    return send(
      res,
      err("QUERY_TOO_SHORT", "Query must be at least 2 characters", {
        source: "tmdb",
      }),
      400,
    );

  const key = `media_v2_search_${type}_${page}_${year}_${Buffer.from(q).toString("base64").slice(0, 30)}`;

  try {
    const { value, isCached } = await cache.getOrFetch(
      key,
      TTL.CATALOG,
      async () => {
        const peoplePromise =
          page === 1 && type !== "movie" && type !== "series"
            ? tmdb("/search/person", { query: q, page: 1 }, "tmdb:search-person")
            : Promise.resolve({ results: [] });

        let data;
        if (year && type !== "person") {
          const [movies, shows] = await Promise.all([
            type === "series"
              ? Promise.resolve({ results: [], total_pages: 1, page: 1, total_results: 0 })
              : tmdb(
                  "/search/movie",
                  { query: q, page, primary_release_year: year },
                  "tmdb:search",
                ),
            type === "movie"
              ? Promise.resolve({ results: [], total_pages: 1, page: 1, total_results: 0 })
              : tmdb(
                  "/search/tv",
                  { query: q, page, first_air_date_year: year },
                  "tmdb:search",
                ),
          ]);
          data = {
            page,
            total_pages: Math.max(movies.total_pages || 1, shows.total_pages || 1),
            total_results: (movies.total_results || 0) + (shows.total_results || 0),
            results: [
              ...(movies.results ?? []).map((item) => ({ ...item, media_type: "movie" })),
              ...(shows.results ?? []).map((item) => ({ ...item, media_type: "tv" })),
            ],
          };
        } else if (type === "person") {
          data = { page: 1, total_pages: 1, total_results: 0, results: [] };
        } else {
          let endpoint = "/search/multi";
          if (type === "movie") endpoint = "/search/movie";
          if (type === "series") endpoint = "/search/tv";
          data = await tmdb(endpoint, { query: q, page }, "tmdb:search");
        }

        const peopleData = await peoplePromise;
        return {
          page: data.page,
          total_pages: data.total_pages,
          total_results: data.total_results,
          results: (data.results ?? [])
            .filter((r) => r.media_type !== "person")
            .map(normalizeListItem)
            .filter(Boolean),
          people: (peopleData.results ?? []).slice(0, 12).map((person) => ({
            id: person.id,
            name: person.name,
            photo: imgUrl(person.profile_path, "w185"),
            knownForDepartment: person.known_for_department ?? null,
            knownForTitles: (person.known_for ?? [])
              .map((item) => item.title || item.name)
              .filter(Boolean)
              .slice(0, 3),
          })).filter((person) => person.id && person.name),
        };
      },
    );

    return send(res, ok(value, { source: "tmdb", isCached }));
  } catch (e) {
    log.error("media search error", { q, message: e.message });
    return send(
      res,
      err("SEARCH_UNAVAILABLE", "Search is temporarily unavailable", {
        source: "tmdb",
      }),
      503,
    );
  }
});

/**
 * GET /api/media/trending?type=all|movie|series&window=day|week
 */
router.get("/trending", async (req, res) => {
  const gate = checkTmdb(res);
  if (gate) return gate;

  const type = ["movie", "tv", "all"].includes(req.query.type)
    ? req.query.type
    : "all";
  const window = ["day", "week"].includes(req.query.window)
    ? req.query.window
    : "week";
  const key = `media_v2_trending_${type}_${window}`;

  try {
    const { value, isCached } = await cache.getOrFetch(
      key,
      TTL.TRENDING,
      async () => {
        const data = await tmdb(
          `/trending/${type}/${window}`,
          {},
          "tmdb:trending",
        );
        return {
          results: (data.results ?? [])
            .slice(0, 20)
            .map(normalizeListItem)
            .filter(Boolean),
        };
      },
    );

    return send(res, ok(value, { source: "tmdb", isCached }));
  } catch (e) {
    log.error("trending error", { message: e.message });
    return send(
      res,
      err("TRENDING_UNAVAILABLE", "Trending data unavailable", {
        source: "tmdb",
      }),
      503,
    );
  }
});

/**
 * GET /api/media/person/:id
 * Person profile detail + known-for credits.
 */
router.get("/person/:id", async (req, res) => {
  const gate = checkTmdb(res);
  if (gate) return gate;

  const id = parseInt(req.params.id, 10);
  if (!id || id < 1) {
    return send(
      res,
      err("INVALID_ID", "Invalid person ID", { source: "tmdb" }),
      400,
    );
  }

  const key = `media_v2_person_${id}`;
  try {
    const { value, isCached } = await cache.getOrFetch(
      key,
      TTL.MEDIA_DETAIL,
      async () => {
        const data = await tmdb(
          `/person/${id}`,
          { append_to_response: "movie_credits,tv_credits" },
          "tmdb:person-detail",
        );

        const combinedCredits = [
          ...(data.movie_credits?.cast ?? []).map((item) => ({
            ...item,
            media_type: "movie",
          })),
          ...(data.tv_credits?.cast ?? []).map((item) => ({
            ...item,
            media_type: "tv",
          })),
        ];

        const seen = new Set();
        const knownFor = combinedCredits
          .sort((left, right) => (right.popularity ?? 0) - (left.popularity ?? 0))
          .filter((item) => {
            const mediaId = Number(item?.id || 0);
            if (!mediaId) return false;
            const mediaType =
              item.media_type === "tv" || item.first_air_date ? "tv" : "movie";
            const dedupeKey = `${mediaType}:${mediaId}`;
            if (seen.has(dedupeKey)) return false;
            seen.add(dedupeKey);
            return true;
          })
          .slice(0, 18)
          .map(normalizePersonKnownForItem)
          .filter(Boolean);

        return {
          id: data.id,
          name: data.name ?? null,
          biography: data.biography ?? null,
          birthday: data.birthday ?? null,
          deathday: data.deathday ?? null,
          placeOfBirth: data.place_of_birth ?? null,
          knownForDepartment: data.known_for_department ?? null,
          profile: imgUrl(data.profile_path, "w780"),
          knownFor,
          filmography: combinedCredits
            .map(normalizePersonKnownForItem)
            .filter((item) => item && (item.releaseDate || item.firstAirDate || item.year))
            .sort((left, right) =>
              String(right.releaseDate || right.firstAirDate || right.year).localeCompare(
                String(left.releaseDate || left.firstAirDate || left.year),
              ),
            )
            .slice(0, 40),
          source: "tmdb",
        };
      },
    );

    return send(res, ok(value, { source: "tmdb", isCached }));
  } catch (e) {
    if (e.status === 404 || e.message?.includes("404")) {
      return send(
        res,
        err("PERSON_NOT_FOUND", `Person ${id} not found`, { source: "tmdb" }),
        404,
      );
    }
    log.error("person detail error", { id, message: e.message });
    return send(
      res,
      err("PERSON_UNAVAILABLE", "Person detail unavailable", { source: "tmdb" }),
      503,
    );
  }
});

/**
 * GET /api/media/trailer/:type/:id
 * Primary trailer URL for a movie or series.
 */
router.get("/trailer/:type/:id", async (req, res) => {
  const gate = checkTmdb(res);
  if (gate) return gate;

  const type = req.params.type === "movie" ? "movie" : "tv";
  const id = parseInt(req.params.id, 10);
  if (!id)
    return send(res, err("INVALID_ID", "Invalid ID", { source: "tmdb" }), 400);

  const key = `media_v2_trailer_${type}_${id}`;

  try {
    const { value, isCached } = await cache.getOrFetch(
      key,
      TTL.TRAILER,
      async () => {
        const data = await tmdb(`/${type}/${id}/videos`, {}, "tmdb:videos");
        const trailer = (data.results ?? [])
          .filter((v) => v.type === "Trailer" && v.site === "YouTube")
          .sort((a, b) => (b.official ? 1 : 0) - (a.official ? 1 : 0))[0];
        return trailer ? normalizeTrailer(trailer) : null;
      },
    );

    if (!value) return send(res, empty(null, { source: "tmdb" }));
    return send(res, ok(value, { source: "tmdb", isCached }));
  } catch (e) {
    log.error("trailer error", { type, id, message: e.message });
    return send(
      res,
      err("TRAILER_UNAVAILABLE", "Trailer unavailable", { source: "tmdb" }),
      503,
    );
  }
});

/**
 * GET /api/media/collection/:id
 * Movies that belong to one TMDB collection.
 */
router.get("/collection/:id", async (req, res) => {
  const gate = checkTmdb(res);
  if (gate) return gate;
  const id = parseInt(req.params.id, 10);
  if (!id) {
    return send(res, err("INVALID_ID", "Invalid collection ID", { source: "tmdb" }), 400);
  }
  const key = `media_v2_collection_${id}`;
  try {
    const { value, isCached } = await cache.getOrFetch(key, TTL.MEDIA_DETAIL, async () => {
      const data = await tmdb(`/collection/${id}`, {}, "tmdb:collection");
      return {
        id: data.id,
        name: data.name ?? "",
        overview: data.overview ?? "",
        poster: imgUrl(data.poster_path, "w500"),
        parts: (data.parts ?? []).map(normalizeListItem).filter(Boolean),
      };
    });
    return send(res, ok(value, { source: "tmdb", isCached }));
  } catch (e) {
    log.error("collection error", { id, message: e.message });
    return send(
      res,
      err("COLLECTION_UNAVAILABLE", "Collection unavailable", { source: "tmdb" }),
      503,
    );
  }
});

/**
 * GET /api/media/providers/:type/:id?region=BE
 * Legal "where to watch" metadata from TMDB (data by JustWatch): which
 * subscription / rent / buy services offer the title in a region.
 */
const PROVIDER_REGION_RE = /^[A-Z]{2}$/;

function normalizeProvider(p) {
  if (!p?.provider_id) return null;
  return {
    id: p.provider_id,
    name: p.provider_name ?? "",
    logo: imgUrl(p.logo_path, "w92"),
    priority: p.display_priority ?? 999,
  };
}

function providerList(list) {
  return (list ?? [])
    .map(normalizeProvider)
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority);
}

router.get("/providers/:type/:id", async (req, res) => {
  const gate = checkTmdb(res);
  if (gate) return gate;

  const type = req.params.type === "movie" ? "movie" : "tv";
  const id = parseInt(req.params.id, 10);
  if (!id)
    return send(res, err("INVALID_ID", "Invalid ID", { source: "tmdb" }), 400);
  const regionRaw = String(req.query.region || "BE").toUpperCase();
  const region = PROVIDER_REGION_RE.test(regionRaw) ? regionRaw : "BE";

  const key = `media_v2_providers_${type}_${id}_${region}`;

  try {
    const { value, isCached } = await cache.getOrFetch(
      key,
      TTL.MEDIA_DETAIL,
      async () => {
        const data = await tmdb(
          `/${type}/${id}/watch/providers`,
          {},
          "tmdb:watch-providers",
        );
        const entry = data?.results?.[region] ?? null;
        return {
          region,
          link: entry?.link ?? null,
          flatrate: providerList(entry?.flatrate),
          free: providerList([...(entry?.free ?? []), ...(entry?.ads ?? [])]),
          rent: providerList(entry?.rent),
          buy: providerList(entry?.buy),
        };
      },
    );
    return send(res, ok(value, { source: "tmdb", isCached }));
  } catch (e) {
    log.error("providers error", { type, id, message: e.message });
    return send(
      res,
      err("PROVIDERS_UNAVAILABLE", "Watch providers unavailable", {
        source: "tmdb",
      }),
      503,
    );
  }
});

export default router;
