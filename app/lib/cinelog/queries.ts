/**
 * CineLog — React Query hooks over the media data layer.
 *
 * Rails read the first page of a browse filter, so a rail on the home screen and
 * the same filter on the Movies page share one cache entry. Every filter except
 * trending paginates, which drives the infinite scroll on the browse pages.
 */

import { useCallback, useMemo, useRef } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { STALE } from "@/lib/query-client";
import {
  MOVIE_LIST_SPECS,
  SERIES_LIST_SPECS,
  canPaginate,
  fetchCollection,
  fetchMovieDetail,
  fetchMovieList,
  fetchMoviesByGenre,
  fetchPerson,
  fetchPrimaryTrailer,
  fetchSeason,
  fetchSeriesByGenre,
  fetchSeriesDetail,
  fetchSeriesList,
  fetchTrending,
  searchMedia,
  fetchWatchProviders,
} from "@/lib/cinelog/api";
import type {
  MediaSummary,
  MediaType,
  MovieListKey,
  PagedResult,
  SeriesListKey,
} from "@/lib/cinelog/types";

export const mediaKeys = {
  trending: () => ["media", "trending"] as const,
  movieList: (list: MovieListKey) => ["media", "movies", "list", list] as const,
  seriesList: (list: SeriesListKey) =>
    ["media", "series", "list", list] as const,
  moviesByGenre: (genreId: number) =>
    ["media", "movies", "genre", genreId] as const,
  seriesByGenre: (genreId: number) =>
    ["media", "series", "genre", genreId] as const,
  movieDetail: (id: number) => ["media", "movie", id] as const,
  seriesDetail: (id: number) => ["media", "series", id] as const,
  season: (seriesId: number, seasonNumber: number) =>
    ["media", "series", seriesId, "season", seasonNumber] as const,
  search: (query: string, year: number | null) =>
    ["media", "search", query, year ?? "any"] as const,
  collection: (id: number) => ["media", "collection", id] as const,
  person: (id: number) => ["media", "person", id] as const,
  trailer: (type: MediaType, id: number) =>
    ["media", "trailer", type, id] as const,
  providers: (type: MediaType, id: number, region: string) =>
    ["media", "providers", type, id, region] as const,
};

function nextPageParam(last: PagedResult<MediaSummary>) {
  // TMDB caps discover at 500 pages; 100 is far past what anyone scrolls.
  return last.page < Math.min(last.totalPages, 100) ? last.page + 1 : undefined;
}

/** Fast-moving lists refresh sooner than the evergreen ones. */
const SHORT_LIVED = new Set(["trending", "now_playing", "new_series"]);

function staleForList(list: string): number {
  return SHORT_LIVED.has(list) ? STALE.short : STALE.medium;
}

/**
 * Rails and browse pages read the same cache entry for a given filter, so both
 * go through one infinite query. A rail shows the first page; a browse page
 * flattens every loaded page. (Mixing `useQuery` and `useInfiniteQuery` on one
 * key would store two incompatible shapes and crash whichever ran second.)
 */
function useMediaList(
  queryKey: readonly unknown[],
  fetchPage: (page: number) => Promise<PagedResult<MediaSummary>>,
  options: { paginates: boolean; staleTime: number; enabled?: boolean },
) {
  return useInfiniteQuery({
    queryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: options.paginates ? nextPageParam : () => undefined,
    staleTime: options.staleTime,
    enabled: options.enabled ?? true,
  });
}

export interface Rail {
  items: MediaSummary[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/** Keeps the rail object (and its refetch callback) referentially stable so
 * memoised rails/cards skip re-rendering when nothing changed. */
function useStableRail(
  items: MediaSummary[],
  isLoading: boolean,
  isError: boolean,
  refetchQuery: () => unknown,
): Rail {
  const refetchRef = useRef(refetchQuery);
  refetchRef.current = refetchQuery;
  const refetch = useCallback(() => void refetchRef.current(), []);
  return useMemo(
    () => ({ items, isLoading, isError, refetch }),
    [items, isLoading, isError, refetch],
  );
}

// ── Rails ────────────────────────────────────────────────────────────────────

export function useMovieRail(
  list: MovieListKey,
  options: { enabled?: boolean } = {},
): Rail {
  const query = useMediaList(
    mediaKeys.movieList(list),
    (page) => fetchMovieList(list, page),
    {
      paginates: canPaginate(MOVIE_LIST_SPECS[list]),
      staleTime: staleForList(list),
      enabled: options.enabled,
    },
  );
  const items = useMemo(() => query.data?.pages[0]?.results ?? [], [query.data]);
  return useStableRail(items, query.isLoading, query.isError, query.refetch);
}

export function useSeriesRail(
  list: SeriesListKey,
  options: { enabled?: boolean } = {},
): Rail {
  const query = useMediaList(
    mediaKeys.seriesList(list),
    (page) => fetchSeriesList(list, page),
    {
      paginates: canPaginate(SERIES_LIST_SPECS[list]),
      staleTime: staleForList(list),
      enabled: options.enabled,
    },
  );
  const items = useMemo(() => query.data?.pages[0]?.results ?? [], [query.data]);
  return useStableRail(items, query.isLoading, query.isError, query.refetch);
}

/** Mixed movie + series feed used by the home hero and the Trending rail. */
export function useTrending(): Rail {
  const query = useQuery({
    queryKey: mediaKeys.trending(),
    queryFn: fetchTrending,
    staleTime: STALE.short,
  });
  const items = useMemo(() => query.data ?? [], [query.data]);
  return useStableRail(items, query.isLoading, query.isError, query.refetch);
}

// ── Browse ───────────────────────────────────────────────────────────────────

export interface Browse {
  items: MediaSummary[];
  isLoading: boolean;
  isError: boolean;
  isLoadingMore: boolean;
  canLoadMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

function dedupe(
  pages: PagedResult<MediaSummary>[] | undefined,
): MediaSummary[] {
  if (!pages) return [];
  const seen = new Set<string>();
  const out: MediaSummary[] = [];
  for (const page of pages) {
    for (const item of page.results) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

function useBrowse(query: ReturnType<typeof useMediaList>): Browse {
  // Deduping every page on each render is O(n); memoise on the page data.
  const items = useMemo(() => dedupe(query.data?.pages), [query.data]);
  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);
  const refetch = useCallback(() => void query.refetch(), [query.refetch]);
  return useMemo(
    () => ({
      items,
      isLoading: query.isLoading,
      isError: query.isError,
      isLoadingMore: query.isFetchingNextPage,
      canLoadMore: Boolean(query.hasNextPage),
      loadMore,
      refetch,
    }),
    [
      items,
      query.isLoading,
      query.isError,
      query.isFetchingNextPage,
      query.hasNextPage,
      loadMore,
      refetch,
    ],
  );
}

export function useMovieBrowse(
  list: MovieListKey,
  genreId: number | null,
): Browse {
  return useBrowse(
    useMediaList(
      genreId !== null
        ? mediaKeys.moviesByGenre(genreId)
        : mediaKeys.movieList(list),
      (page) =>
        genreId !== null
          ? fetchMoviesByGenre(genreId, page)
          : fetchMovieList(list, page),
      {
        paginates: genreId !== null || canPaginate(MOVIE_LIST_SPECS[list]),
        staleTime: genreId !== null ? STALE.medium : staleForList(list),
      },
    ),
  );
}

export function useSeriesBrowse(
  list: SeriesListKey,
  genreId: number | null,
): Browse {
  return useBrowse(
    useMediaList(
      genreId !== null
        ? mediaKeys.seriesByGenre(genreId)
        : mediaKeys.seriesList(list),
      (page) =>
        genreId !== null
          ? fetchSeriesByGenre(genreId, page)
          : fetchSeriesList(list, page),
      {
        paginates: genreId !== null || canPaginate(SERIES_LIST_SPECS[list]),
        staleTime: genreId !== null ? STALE.medium : staleForList(list),
      },
    ),
  );
}

// ── Detail ───────────────────────────────────────────────────────────────────

export function useMovieDetail(tmdbId: number | null) {
  return useQuery({
    queryKey: mediaKeys.movieDetail(tmdbId ?? 0),
    queryFn: () => fetchMovieDetail(tmdbId as number),
    enabled: typeof tmdbId === "number" && tmdbId > 0,
    staleTime: STALE.long,
  });
}

export function useSeriesDetail(tmdbId: number | null) {
  return useQuery({
    queryKey: mediaKeys.seriesDetail(tmdbId ?? 0),
    queryFn: () => fetchSeriesDetail(tmdbId as number),
    enabled: typeof tmdbId === "number" && tmdbId > 0,
    staleTime: STALE.long,
  });
}

export function useSeason(
  seriesId: number | null,
  seasonNumber: number | null,
) {
  return useQuery({
    queryKey: mediaKeys.season(seriesId ?? 0, seasonNumber ?? 0),
    queryFn: () => fetchSeason(seriesId as number, seasonNumber as number),
    enabled:
      typeof seriesId === "number" &&
      seriesId > 0 &&
      typeof seasonNumber === "number" &&
      seasonNumber > 0,
    staleTime: STALE.long,
  });
}

export function usePerson(personId: number | null) {
  return useQuery({
    queryKey: mediaKeys.person(personId ?? 0),
    queryFn: () => fetchPerson(personId as number),
    enabled: typeof personId === "number" && personId > 0,
    staleTime: STALE.long,
  });
}

export function useTrailer(
  type: MediaType,
  tmdbId: number | null,
  enabled = true,
) {
  return useQuery({
    queryKey: mediaKeys.trailer(type, tmdbId ?? 0),
    queryFn: () => fetchPrimaryTrailer(type, tmdbId as number),
    enabled: enabled && typeof tmdbId === "number" && tmdbId > 0,
    staleTime: STALE.long,
  });
}

// ── Search ───────────────────────────────────────────────────────────────────

export function useSearch(query: string, year: number | null = null) {
  const trimmed = query.trim();
  const result = useInfiniteQuery({
    queryKey: mediaKeys.search(trimmed.toLowerCase(), year),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => searchMedia(trimmed, pageParam, year ?? undefined),
    getNextPageParam: (last) =>
      last.page < Math.min(last.totalPages, 20) ? last.page + 1 : undefined,
    enabled: trimmed.length >= 2,
    staleTime: STALE.medium,
  });
  const data = useMemo(() => {
    const pages = result.data?.pages ?? [];
    if (pages.length === 0) return undefined;
    const seen = new Set<string>();
    const movies: MediaSummary[] = [];
    const series: MediaSummary[] = [];
    for (const page of pages) {
      for (const item of page.movies) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        movies.push(item);
      }
      for (const item of page.series) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        series.push(item);
      }
    }
    return {
      movies,
      series,
      people: pages[0]?.people ?? [],
      page: pages[pages.length - 1]?.page ?? 1,
      totalPages: pages[0]?.totalPages ?? 1,
    };
  }, [result.data]);
  return {
    data,
    isFetching: result.isFetching,
    isError: result.isError,
    refetch: result.refetch,
    hasNextPage: result.hasNextPage,
    fetchNextPage: result.fetchNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
  };
}

export function useCollection(collectionId: number | null) {
  return useQuery({
    queryKey: mediaKeys.collection(collectionId ?? 0),
    queryFn: () => fetchCollection(collectionId as number),
    enabled: typeof collectionId === "number" && collectionId > 0,
    staleTime: STALE.long,
  });
}

/** Interleave two feeds so neither media type dominates a mixed rail. */
export function useInterleaved(left: MediaSummary[], right: MediaSummary[]) {
  return useMemo(() => {
    const mixed: MediaSummary[] = [];
    for (
      let index = 0;
      index < Math.max(left.length, right.length);
      index += 1
    ) {
      if (left[index]) mixed.push(left[index]);
      if (right[index]) mixed.push(right[index]);
    }
    return mixed;
  }, [left, right]);
}

// ── Where to watch ───────────────────────────────────────────────────────────

export function useWatchProviders(
  type: MediaType,
  tmdbId: number | null,
  region = "BE",
) {
  return useQuery({
    queryKey: mediaKeys.providers(type, tmdbId ?? 0, region),
    queryFn: () => fetchWatchProviders(type, tmdbId as number, region),
    enabled: typeof tmdbId === "number" && tmdbId > 0,
    staleTime: STALE.long,
    retry: 1,
  });
}
