/**
 * Household profiles that live on this device. Each profile has its own
 * library snapshot. This is not a separate account.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const COLORS = ["#E23D3D", "#3D8BE2", "#3DBE7A", "#E2A23D", "#A23DE2", "#3DCEE2"];

export interface HouseholdProfile {
  id: string;
  name: string;
  color: string;
}

export interface ProfilesState {
  profiles: HouseholdProfile[];
  activeId: string;
  addProfile: (name: string) => HouseholdProfile;
  setActive: (id: string) => void;
}

const DEFAULT_PROFILE: HouseholdProfile = { id: "home", name: "You", color: COLORS[0] };

export const useProfiles = create<ProfilesState>()(
  persist(
    (set, get) => ({
      profiles: [DEFAULT_PROFILE],
      activeId: DEFAULT_PROFILE.id,
      addProfile: (name) => {
        const trimmed = name.trim().slice(0, 24) || "Profile";
        const created: HouseholdProfile = {
          id: `p${Date.now().toString(36)}`,
          name: trimmed,
          color: COLORS[get().profiles.length % COLORS.length],
        };
        set((state) => ({
          profiles: [...state.profiles, created],
          activeId: created.id,
        }));
        return created;
      },
      setActive: (activeId) => set({ activeId }),
    }),
    {
      name: "cinelog.profiles.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function activeProfileName(): string {
  const { profiles, activeId } = useProfiles.getState();
  return profiles.find((profile) => profile.id === activeId)?.name || "You";
}
