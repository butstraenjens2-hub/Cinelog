/**
 * Swaps the on-device library when the active household profile changes.
 * Inactive profiles are snapshots in AsyncStorage. Nothing is uploaded.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useLibrary } from "@/store/library-store";
import { useProfiles, type HouseholdProfile } from "@/store/profiles-store";

const EMPTY = {
  watchlist: [],
  favorites: [],
  ratings: {},
  history: [],
  progress: {},
  episodes: {},
  recentSearches: [],
};

function storageKey(id: string): string {
  return `cinelog.library.profile.${id}`;
}

function currentData() {
  const state = useLibrary.getState();
  return {
    watchlist: state.watchlist,
    favorites: state.favorites,
    ratings: state.ratings,
    history: state.history,
    progress: state.progress,
    episodes: state.episodes,
    recentSearches: state.recentSearches,
  };
}

function applyData(raw: string | null): void {
  const parsed = raw ? (JSON.parse(raw) as Partial<typeof EMPTY>) : EMPTY;
  useLibrary.setState({
    watchlist: Array.isArray(parsed.watchlist) ? parsed.watchlist : [],
    favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
    ratings: parsed.ratings && typeof parsed.ratings === "object" ? parsed.ratings : {},
    history: Array.isArray(parsed.history) ? parsed.history : [],
    progress: parsed.progress && typeof parsed.progress === "object" ? parsed.progress : {},
    episodes: parsed.episodes && typeof parsed.episodes === "object" ? parsed.episodes : {},
    recentSearches: Array.isArray(parsed.recentSearches) ? parsed.recentSearches : [],
  } as Partial<ReturnType<typeof useLibrary.getState>>);
}

export async function activateHouseholdProfile(nextId: string): Promise<void> {
  const profiles = useProfiles.getState();
  const current = profiles.activeId;
  if (!nextId || nextId === current) return;
  if (!profiles.profiles.some((profile) => profile.id === nextId)) return;
  await AsyncStorage.setItem(storageKey(current), JSON.stringify(currentData()));
  const saved = await AsyncStorage.getItem(storageKey(nextId));
  applyData(saved);
  useProfiles.getState().setActive(nextId);
}

export async function createHouseholdProfile(name: string): Promise<HouseholdProfile> {
  const profiles = useProfiles.getState();
  await AsyncStorage.setItem(storageKey(profiles.activeId), JSON.stringify(currentData()));
  const created = profiles.addProfile(name);
  applyData(null);
  return created;
}
