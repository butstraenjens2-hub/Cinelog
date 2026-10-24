import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { useT } from "@/i18n";
import { SeoHead } from "@/components/SeoHead";
import { Footer } from "@/components/layout/Footer";
import { FloatingBackButton } from "@/components/navigation/MobileHeader";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/States";
import { FONTS, SPACING } from "@/constants/theme";
import { makeStyles } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import { fetchSeriesDetail } from "@/lib/cinelog/api";
import { openTitle } from "@/lib/cinelog/navigation";
import { episodeCode, trackedSeries } from "@/lib/cinelog/upNext";
import { scheduleBucket } from "@/lib/schedule/window.mjs";
import { useLibrary } from "@/store/library-store";

interface AiringRow {
  id: string;
  title: string;
  tmdbId: number;
  when: string;
  bucket: "today" | "week";
}

export default function ScheduleScreen() {
  const t = useT();
  const styles = useStyles();
  const { gutter } = useResponsive();
  const history = useLibrary((state) => state.history);
  const episodes = useLibrary((state) => state.episodes);
  const watchlist = useLibrary((state) => state.watchlist);
  const tracked = trackedSeries(history, episodes, watchlist, 40);
  const query = useQuery({
    queryKey: ["airing", tracked.map((item) => item.id).join(",")],
    queryFn: async (): Promise<AiringRow[]> => {
      const rows: AiringRow[] = [];
      for (const ref of tracked) {
        try {
          const detail = await fetchSeriesDetail(ref.tmdbId);
          const next = detail.title.nextEpisode;
          const bucket = next?.airDate ? scheduleBucket(next.airDate) : null;
          if (!next || (bucket !== "today" && bucket !== "week")) continue;
          rows.push({
            id: ref.id,
            tmdbId: ref.tmdbId,
            title: `${ref.title} ${episodeCode(next.seasonNumber, next.episodeNumber)}`,
            when: next.airDate ?? "",
            bucket,
          });
        } catch {
          // One show without a date does not hide the rest.
        }
      }
      return rows.sort((left, right) => left.when.localeCompare(right.when));
    },
  });
  const rows = query.data ?? [];
  const today = rows.filter((row) => row.bucket === "today");
  const week = rows.filter((row) => row.bucket === "week");

  return (
    <>
      <SeoHead title={t("Airing schedule")} description={t("Episodes from the shows you follow.")} />
      <Screen reserveBottomNav>
        <FloatingBackButton onPress={() => router.back()} gutter={gutter} />
        <View style={[styles.head, { paddingHorizontal: gutter }]}>
          <Text style={styles.title} accessibilityRole="header">
            {t("Airing schedule")}
          </Text>
          <Text style={styles.copy}>
            {t("Today and the rest of this week for shows on your watchlist or in your history. Episode reminders are the notification setting in Settings.")}
          </Text>
          <Button
            label={t("Notification settings")}
            variant="secondary"
            size="sm"
            onPress={() => router.push("/settings")}
          />
        </View>
        {tracked.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title={t("No followed shows")}
            message={t("Save a series or mark an episode to see when it airs.")}
          />
        ) : query.isLoading ? null : today.length === 0 && week.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title={t("Nothing is airing")}
            message={t("None of the shows you follow have an episode dated for today or this week.")}
          />
        ) : (
          <View style={{ paddingHorizontal: gutter, gap: SPACING.lg }}>
            <DayGroup title={t("Airing today")} rows={today} />
            <DayGroup title={t("This week")} rows={week} />
          </View>
        )}
        <Footer />
      </Screen>
    </>
  );
}

function DayGroup({ title, rows }: { title: string; rows: AiringRow[] }) {
  const styles = useStyles();
  if (rows.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {rows.map((row) => (
        <Button
          key={`${row.id}-${row.when}`}
          label={`${row.when.slice(5)}  ${row.title}`}
          variant="secondary"
          size="sm"
          onPress={() => openTitle({ type: "series", tmdbId: row.tmdbId })}
        />
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  head: { gap: SPACING.sm, paddingTop: 96, paddingBottom: SPACING.md },
  title: { fontFamily: FONTS.extrabold, fontSize: 30, color: c.textPrimary },
  copy: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: c.textSecondary },
  group: { gap: SPACING.sm, alignItems: "flex-start" },
  groupTitle: { fontFamily: FONTS.bold, fontSize: 17, color: c.textPrimary },
}));
