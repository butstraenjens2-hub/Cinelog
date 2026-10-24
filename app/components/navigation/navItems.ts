/** CineLog — shared navigation definitions for the mobile and desktop shells. */

import type { Ionicons } from "@expo/vector-icons";

export interface NavItem {
  /** Route inside the tab group. */
  route: "/home" | "/movies" | "/series" | "/live" | "/iptv" | "/search" | "/watchlist";
  label: string;
  /** Short label for the phone bar, shown only on the active tab. */
  shortLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}

/** Bottom navigation on mobile; the first five items of the desktop nav. */
export const NAV_ITEMS: NavItem[] = [
  { route: "/home", label: "Home", shortLabel: "Home", icon: "home-outline", activeIcon: "home" },
  { route: "/movies", label: "Movies", shortLabel: "Films", icon: "film-outline", activeIcon: "film" },
  { route: "/series", label: "Series", shortLabel: "Shows", icon: "tv-outline", activeIcon: "tv" },
  { route: "/live", label: "Live TV", shortLabel: "Live", icon: "radio-outline", activeIcon: "radio" },
  { route: "/iptv", label: "IPTV", shortLabel: "IPTV", icon: "list-outline", activeIcon: "list" },
  { route: "/search", label: "Search", shortLabel: "Find", icon: "search-outline", activeIcon: "search" },
  {
    route: "/watchlist",
    label: "Watchlist",
    shortLabel: "Saved",
    icon: "heart-outline",
    activeIcon: "heart",
  },
];
