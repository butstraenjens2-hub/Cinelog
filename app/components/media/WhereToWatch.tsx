/**
 * CineLog — "Waar kijken?" section.
 *
 * Shows where a title is legally available (subscription, free, rent, buy) in
 * Belgium, using TMDB's watch-provider data (sourced from JustWatch). Tapping
 * opens the TMDB/JustWatch overview page with the direct provider links. This is
 * metadata only; nothing is played inside CineLog.
 */

import React from "react";
import { Linking, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { useT } from "@/i18n";
import { Pressable } from "@/components/ui/Pressable";
import { FONTS, RADIUS, SPACING } from "@/constants/theme";
import { makeStyles, useTheme } from "@/theme";
import { useWatchProviders } from "@/lib/cinelog/queries";
import type { MediaType, WatchProvider } from "@/lib/cinelog/types";
import { useSettings } from "@/store/settings-store";

export interface WhereToWatchProps {
  type: MediaType;
  tmdbId: number;
  gutter: number;
  region?: string;
}

const GROUPS = [
  { key: "flatrate", label: "Stream" },
  { key: "free", label: "Free" },
  { key: "rent", label: "Rent" },
  { key: "buy", label: "Buy" },
] as const;

export function WhereToWatch({
  type,
  tmdbId,
  gutter,
  region,
}: WhereToWatchProps) {
  const t = useT();
  const styles = useStyles();
  const { colors } = useTheme();
  const storedRegion = useSettings((state) => state.watchRegion);
  const activeRegion = (region || storedRegion || "BE").toUpperCase();
  const providers = useWatchProviders(type, tmdbId, activeRegion);

  // Stay silent while loading or when the lookup fails; this is a bonus section.
  if (!providers.data) return null;
  const data = providers.data;
  const regionCode = data.region || activeRegion;
  const groups = GROUPS.map((group) => ({
    ...group,
    items: data[group.key] as WatchProvider[],
  })).filter((group) => group.items.length > 0);

  const openLink = () => {
    const url =
      data.link ??
      `https://www.themoviedb.org/${type === "movie" ? "movie" : "tv"}/${tmdbId}/watch?locale=${regionCode}`;
    void Linking.openURL(url).catch(() => undefined);
  };

  return (
    <View style={[styles.wrap, { paddingHorizontal: gutter }]}>
      <Text style={styles.heading} accessibilityRole="header">
        {t("Where to watch?")}
      </Text>
      {groups.length === 0 ? (
        <Text style={styles.empty}>
          {t("Not currently available on streaming services in {{region}}.", {
            region: regionCode,
          })}
        </Text>
      ) : (
        groups.map((group) => (
          <View key={group.key} style={styles.group}>
            <Text style={styles.groupLabel}>{t(group.label, undefined, "provider")}</Text>
            <View style={styles.logos}>
              {group.items.map((provider) => (
                <Pressable
                  key={provider.id}
                  onPress={openLink}
                  accessibilityRole="link"
                  accessibilityLabel={provider.name}
                  style={styles.logoWrap}
                >
                  {provider.logo ? (
                    <Image
                      source={{ uri: provider.logo }}
                      style={styles.logo}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <Text style={styles.logoFallback} numberOfLines={2}>
                      {provider.name}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ))
      )}
      <Pressable onPress={openLink} accessibilityRole="link" style={styles.more}>
        <Text style={styles.moreText}>{t("View all offers")}</Text>
        <Ionicons name="open-outline" size={14} color={colors.accent} />
      </Pressable>
      <Text style={styles.attribution}>{t("Data by JustWatch via TMDB")}</Text>
    </View>
  );
}

const LOGO = 44;

const useStyles = makeStyles((c) => ({
  wrap: { gap: SPACING.md },
  heading: { fontFamily: FONTS.bold, fontSize: 19, color: c.textPrimary },
  empty: { fontFamily: FONTS.regular, fontSize: 14, color: c.textSecondary },
  group: { gap: SPACING.sm },
  groupLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: c.textMuted,
  },
  logos: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  logoWrap: {
    width: LOGO,
    height: LOGO,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: LOGO, height: LOGO },
  logoFallback: {
    fontFamily: FONTS.medium,
    fontSize: 9,
    color: c.textSecondary,
    textAlign: "center",
  },
  more: { flexDirection: "row", alignItems: "center", gap: SPACING.xs, alignSelf: "flex-start" },
  moreText: { fontFamily: FONTS.semibold, fontSize: 13, color: c.accent },
  attribution: { fontFamily: FONTS.regular, fontSize: 11, color: c.textFaint },
}));
