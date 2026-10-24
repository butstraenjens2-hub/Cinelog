/**
 * Live TV tab. Plays only the curated legal channels and shows a guide built
 * from our XMLTV reader. Channels without a verified in-app stream open the
 * broadcaster's official page.
 */

import React, { useMemo, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useT } from "@/i18n";
import { SeoHead } from "@/components/SeoHead";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { Screen } from "@/components/ui/Screen";
import { BroadcastPlayer } from "@/components/player/BroadcastPlayer";
import { Pressable } from "@/components/ui/Pressable";
import { FONTS, RADIUS, SPACING } from "@/constants/theme";
import { makeStyles, useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import { LEGAL_CHANNELS, type LegalChannel } from "@/lib/live/channels";
import { buildGuideXml, parseXmltv, programmesBetween } from "@/lib/live/xmltv.mjs";
import { useAuth } from "@/store/auth-store";

const HOUR = 60 * 60 * 1000;
const WINDOW = 8 * HOUR;
const HOUR_WIDTH = 148;

export default function LiveTvScreen() {
  const t = useT();
  const styles = useStyles();
  const { isMobile, gutter, width } = useResponsive();
  const user = useAuth((state) => state.user);
  const playable = LEGAL_CHANNELS.filter((channel) => channel.streamUrl);
  const [selectedId, setSelectedId] = useState(playable[0]?.id ?? LEGAL_CHANNELS[0].id);
  const selected = LEGAL_CHANNELS.find((channel) => channel.id === selectedId) ?? LEGAL_CHANNELS[0];

  const guide = useMemo(() => {
    const now = Date.now();
    const start = now - (now % HOUR);
    const parsed = parseXmltv(
      buildGuideXml(
        LEGAL_CHANNELS.map((channel) => ({
          id: channel.id,
          name: channel.name,
          summary: channel.summary,
        })),
        now,
      ),
    );
    return {
      start,
      programmes: programmesBetween(parsed.programmes, start, start + WINDOW),
    };
  }, []);

  const hours = Array.from({ length: 8 }, (_, index) => guide.start + index * HOUR);

  return (
    <>
      <SeoHead
        title={t("Live TV")}
        description="Official free live channels from France 24, DW and Al Jazeera. NASA+ and NHK WORLD-JAPAN open their official pages."
      />
      <Screen
        reserveBottomNav
        scroll={false}
        contentStyle={{ flex: 1 }}
        header={
          isMobile ? (
            <MobileHeader
              title={t("Live TV")}
              onOpenProfile={() => router.push("/profile")}
              gutter={gutter}
              displayName={user?.displayName ?? t("Guest")}
              avatarUrl={user?.avatarUrl ?? null}
            />
          ) : null
        }
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ paddingHorizontal: gutter, gap: SPACING.sm, paddingTop: SPACING.md }}>
            {isMobile ? null : (
              <Text style={styles.title} accessibilityRole="header">
                {t("Live TV")}
              </Text>
            )}
            <Text style={styles.copy}>
              {t(
                "Official free channels from France 24, DW and Al Jazeera. NASA+ and NHK WORLD-JAPAN open their official pages.",
              )}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.channelRow, { paddingHorizontal: gutter }]}
          >
            {LEGAL_CHANNELS.map((channel) => {
              const active = channel.id === selected.id;
              return (
                <Pressable
                  key={channel.id}
                  onPress={() => setSelectedId(channel.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={channel.name}
                  style={[styles.channel, active ? styles.channelActive : null]}
                >
                  <Text style={styles.channelName} numberOfLines={1}>
                    {channel.name}
                  </Text>
                  <Text style={styles.channelMeta} numberOfLines={1}>
                    {channel.streamUrl ? t("Live") : t("Official page")}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ paddingHorizontal: gutter, gap: SPACING.sm }}>
            {selected.streamUrl ? (
              <BroadcastPlayer key={selected.streamUrl} url={selected.streamUrl} />
            ) : (
              <Pressable
                onPress={() => void Linking.openURL(selected.officialUrl)}
                accessibilityRole="link"
                style={styles.external}
              >
                <Text style={styles.channelName}>{t("Watch on the official site")}</Text>
                <Text style={styles.copy}>{selected.officialUrl}</Text>
              </Pressable>
            )}
            <Text style={styles.broadcaster}>
              {selected.broadcaster} · {selected.language}
            </Text>
            <Text style={styles.copy}>{selected.summary}</Text>
            <Pressable
              onPress={() => void Linking.openURL(selected.officialUrl)}
              accessibilityRole="link"
            >
              <Text style={styles.link}>{t("Schedule on the official site")}</Text>
            </Pressable>
          </View>

          <Text style={[styles.guideTitle, { paddingHorizontal: gutter }]}>{t("Guide")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={[styles.hourRow, { marginLeft: 132 }]}>
                {hours.map((hour) => (
                  <Text key={hour} style={[styles.hour, { width: HOUR_WIDTH }]}>
                    {new Date(hour).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                ))}
              </View>
              {LEGAL_CHANNELS.map((channel) => (
                <GuideRow
                  key={channel.id}
                  channel={channel}
                  start={guide.start}
                  programmes={guide.programmes.filter((item) => item.channelId === channel.id)}
                  selected={channel.id === selected.id}
                  onPress={() => setSelectedId(channel.id)}
                  width={Math.max(width, 132 + HOUR_WIDTH * 8)}
                />
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      </Screen>
    </>
  );
}

function GuideRow({
  channel,
  start,
  programmes,
  selected,
  onPress,
  width,
}: {
  channel: LegalChannel;
  start: number;
  programmes: { startMs: number; stopMs: number; title: string }[];
  selected: boolean;
  onPress: () => void;
  width: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.guideRow, { width }]}>
      <Pressable onPress={onPress} style={styles.guideLabel}>
        <Text style={[styles.guideName, selected ? { color: colors.accent } : null]} numberOfLines={2}>
          {channel.name}
        </Text>
      </Pressable>
      <View style={[styles.blocks, { width: HOUR_WIDTH * 8 }]}>
        {programmes.map((programme) => {
          const left = ((programme.startMs - start) / HOUR) * HOUR_WIDTH;
          const blockWidth = Math.max(
            72,
            ((programme.stopMs - programme.startMs) / HOUR) * HOUR_WIDTH - 6,
          );
          return (
            <Pressable
              key={`${programme.startMs}`}
              onPress={onPress}
              style={[styles.block, { left, width: blockWidth }]}
            >
              <Text style={styles.blockTitle} numberOfLines={2}>
                {programme.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  title: { fontFamily: FONTS.extrabold, fontSize: 30, color: c.textPrimary },
  copy: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, color: c.textSecondary },
  channelRow: { gap: SPACING.sm, paddingVertical: SPACING.md },
  channel: {
    width: 168,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    gap: 4,
  },
  channelActive: { borderColor: c.accent },
  channelName: { fontFamily: FONTS.semibold, fontSize: 14, color: c.textPrimary },
  channelMeta: { fontFamily: FONTS.regular, fontSize: 12, color: c.textMuted },
  external: {
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    gap: SPACING.sm,
  },
  broadcaster: { fontFamily: FONTS.semibold, fontSize: 12, color: c.textMuted },
  link: { fontFamily: FONTS.semibold, fontSize: 13, color: c.accent },
  guideTitle: {
    fontFamily: FONTS.bold,
    fontSize: 19,
    color: c.textPrimary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  hourRow: { flexDirection: "row" },
  hour: { fontFamily: FONTS.medium, fontSize: 11, color: c.textMuted, paddingBottom: 4 },
  guideRow: { flexDirection: "row", height: 64, alignItems: "center" },
  guideLabel: { width: 132, paddingRight: SPACING.sm, justifyContent: "center" },
  guideName: { fontFamily: FONTS.semibold, fontSize: 12, color: c.textPrimary },
  blocks: { height: 52, position: "relative" },
  block: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: RADIUS.sm,
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  blockTitle: { fontFamily: FONTS.medium, fontSize: 11, color: c.textPrimary },
}));
