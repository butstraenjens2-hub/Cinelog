/**
 * CineLog — mobile bottom navigation.
 *
 * Large touch targets, an accent indicator on the active tab, and safe-area
 * aware padding so it sits correctly above the home indicator.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "@/i18n";
import { NAV_ITEMS } from "@/components/navigation/navItems";
import { FONTS, LAYOUT, SPACING } from "@/constants/theme";
import { makeStyles, useTheme } from "@/theme";

export interface BottomNavigationProps {
  /** Current tab route, e.g. "/home". */
  activeRoute: string;
  onNavigate: (route: string) => void;
}

export function BottomNavigation({
  activeRoute,
  onNavigate,
}: BottomNavigationProps) {
  const t = useT();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingBottom: Math.max(insets.bottom, SPACING.sm),
          paddingHorizontal: SPACING.xs,
        },
      ]}
      accessibilityRole="tablist"
      accessibilityLabel={t("Main navigation")}
    >
      {/* Glass effect blur on all platforms */}
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.row}>
        {NAV_ITEMS.map((item) => {
          const active = activeRoute === item.route;
          return (
            <Pressable
              key={item.route}
              onPress={() => onNavigate(item.route)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(item.label)}
              style={styles.tab}
              hitSlop={4}
            >
              <View style={[styles.iconWrap, active ? styles.iconWrapActive : null]}>
                <Ionicons
                  name={active ? item.activeIcon : item.icon}
                  size={22}
                  color={active ? "#FFFFFF" : colors.textMuted}
                />
              </View>
              <Text style={[styles.label, active ? styles.labelActive : null]} numberOfLines={1}>
                {active ? t(item.shortLabel) : " "}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c, t) => ({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: LAYOUT.bottomNavHeight,
    paddingTop: 4,
    paddingBottom: 4,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: c.accent,
    borderRadius: 18,
    borderWidth: 0,
    shadowColor: c.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  label: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    lineHeight: 12,
    textAlign: "center",
    color: "transparent",
    includeFontPadding: false,
    width: "100%",
  },
  labelActive: {
    color: "#FFFFFF",
  },
}));
