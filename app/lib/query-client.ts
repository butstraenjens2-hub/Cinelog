/**
 * CineLog — React Query client.
 *
 * Movie metadata changes slowly, so cached data stays fresh for a long time and
 * inactive queries are kept in memory long enough to make back-navigation feel
 * instant without refetching.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, focusManager, type Query } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";

// Keep React Query's "focused" state accurate on native so per-query
// refetchOnWindowFocus overrides behave the same as on web.
focusManager.setEventListener((onFocus) => {
  const subscription = AppState.addEventListener("change", (state) => {
    onFocus(state === "active");
  });
  return () => subscription.remove();
});

export const STALE = {
  /** Trending and "now playing" style lists. */
  short: 10 * 60 * 1000,
  /** Catalogue pages and genre browses. */
  medium: 60 * 60 * 1000,
  /** Detail pages, cast, seasons — effectively immutable. */
  long: 12 * 60 * 60 * 1000,
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE.medium,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // One network blip (or a cold API wake-up) should not surface an error
      // screen; queries are GET-only, so retrying is always safe.
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: { retry: false },
  },
});

const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

/** Only list and detail metadata is persisted; search results and anything
 * outside the "media" namespace stay in memory only. */
const PERSISTED_SECTIONS = new Set(["trending", "movies", "series", "movie", "person", "trailer"]);

export function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== "success") return false;
  const [root, section] = query.queryKey as unknown[];
  return root === "media" && typeof section === "string" && PERSISTED_SECTIONS.has(section);
}

/** Restores the media cache on cold start so rails render instantly. */
export const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister: createAsyncStoragePersister({
    storage: Platform.OS === "web" && typeof window === "undefined" ? undefined : AsyncStorage,
    key: "cinelog-query-cache",
    throttleTime: 2000,
  }),
  maxAge: PERSIST_MAX_AGE,
  buster: String(Constants.expoConfig?.version ?? ""),
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
};
