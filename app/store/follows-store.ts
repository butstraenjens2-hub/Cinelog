/**
 * Actors, studios, and networks the viewer follows. Stored on the device.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type FollowKind = "studio" | "network";

export interface FollowedPerson {
  id: number;
  name: string;
  photo: string | null;
  knownForDepartment: string | null;
}

export interface FollowedCompany {
  id: number;
  name: string;
  kind: FollowKind;
  logo: string | null;
}

interface FollowsState {
  people: FollowedPerson[];
  companies: FollowedCompany[];
  isFollowingPerson: (id: number) => boolean;
  isFollowingCompany: (id: number, kind: FollowKind) => boolean;
  togglePerson: (person: FollowedPerson) => void;
  toggleCompany: (company: FollowedCompany) => void;
}

export const useFollows = create<FollowsState>()(
  persist(
    (set, get) => ({
      people: [],
      companies: [],
      isFollowingPerson: (id) => get().people.some((person) => person.id === id),
      isFollowingCompany: (id, kind) =>
        get().companies.some((company) => company.id === id && company.kind === kind),
      togglePerson: (person) =>
        set((state) => ({
          people: state.people.some((entry) => entry.id === person.id)
            ? state.people.filter((entry) => entry.id !== person.id)
            : [person, ...state.people],
        })),
      toggleCompany: (company) =>
        set((state) => ({
          companies: state.companies.some(
            (entry) => entry.id === company.id && entry.kind === company.kind,
          )
            ? state.companies.filter(
                (entry) => !(entry.id === company.id && entry.kind === company.kind),
              )
            : [company, ...state.companies],
        })),
    }),
    {
      name: "cinelog.follows.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
