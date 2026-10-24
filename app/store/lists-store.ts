/**
 * Named lists of movies and series, separate from the watchlist.
 * Stored on the device.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { LibraryEntryRef, MediaId } from "@/lib/cinelog/types";

export interface NamedList {
  id: string;
  name: string;
  createdAt: string;
  items: LibraryEntryRef[];
}

interface ListsState {
  lists: NamedList[];
  createList: (name: string, items?: LibraryEntryRef[]) => string;
  renameList: (id: string, name: string) => void;
  deleteList: (id: string) => void;
  toggleItem: (id: string, item: LibraryEntryRef) => void;
  contains: (id: string, mediaId: MediaId) => boolean;
}

function listId(): string {
  return `list_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useLists = create<ListsState>()(
  persist(
    (set, get) => ({
      lists: [],
      createList: (name, items = []) => {
        const id = listId();
        const trimmed = name.trim().slice(0, 80) || "List";
        set((state) => ({
          lists: [
            {
              id,
              name: trimmed,
              createdAt: new Date().toISOString(),
              items,
            },
            ...state.lists,
          ],
        }));
        return id;
      },
      renameList: (id, name) =>
        set((state) => ({
          lists: state.lists.map((list) =>
            list.id === id ? { ...list, name: name.trim().slice(0, 80) || list.name } : list,
          ),
        })),
      deleteList: (id) =>
        set((state) => ({ lists: state.lists.filter((list) => list.id !== id) })),
      toggleItem: (id, item) =>
        set((state) => ({
          lists: state.lists.map((list) => {
            if (list.id !== id) return list;
            const exists = list.items.some((entry) => entry.id === item.id);
            return {
              ...list,
              items: exists
                ? list.items.filter((entry) => entry.id !== item.id)
                : [item, ...list.items],
            };
          }),
        })),
      contains: (id, mediaId) =>
        get().lists.some(
          (list) => list.id === id && list.items.some((item) => item.id === mediaId),
        ),
    }),
    {
      name: "cinelog.lists.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
