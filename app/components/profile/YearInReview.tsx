/** CineLog — "year in review" card plus watch streak on the profile page. */

import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { useLocale, useT } from "@/i18n";
import { FilterBar } from "@/components/media/FilterBar";
import { FONTS, RADIUS, SPACING } from "@/constants/theme";
import { makeStyles } from "@/theme";
import { activeYears, watchStreak, yearInReview } from "@/lib/cinelog/stats";
import { useLibrary } from "@/store/library-store";

export function YearInReviewCard({ gutter }: { gutter: number }) {
  const t = useT();
  const locale = useLocale();
  const styles = useStyles();
  const history = useLibrary((state) => state.history);
  const episodes = useLibrary((state) => state.episodes);
  const ratings = useLibrary((state) => state.ratings);

  const years = useMemo(() => activeYears(history, episodes), [history, episodes]);
  const [year, setYear] = useState(years[0]);
  const review = useMemo(
    () => yearInReview(year, history, episodes, ratings),
    [year, history, episodes, ratings],
  );
  const streak = useMemo(() => watchStreak(history, episodes), [history, episodes]);

  const monthLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { month: "narrow" });
    return Array.from({ length: 12 }, (_, m) => formatter.format(new Date(2020, m, 1)));
  }, [locale]);
  const busiestLabel =
    review.busiestMonth !== null
      ? new Intl.DateTimeFormat(locale, { month: "long" }).format(
          new Date(2020, review.busiestMonth, 1),
        )
      : null;
  const peak = Math.max(1, ...review.months);
  const empty = review.movies + review.episodes === 0;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { paddingHorizontal: gutter }]} accessibilityRole="header">
        {t("Your {{year}} in review", { year })}
      </Text>
      {years.length > 1 ? (
        <FilterBar
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
          value={String(year)}
          onChange={(value) => setYear(Number(value))}
          gutter={gutter}
          accessibilityLabel={t("Year")}
        />
      ) : null}

      <View style={[styles.card, { marginHorizontal: gutter }]}>
        {empty ? (
          <Text style={styles.muted}>
            {t("Mark movies and episodes as watched to build your year in review.")}
          </Text>
        ) : (
          <>
            <View style={styles.row}>
              <Stat value={review.movies} label={t("Movies")} />
              <Stat value={review.episodes} label={t("Episodes")} />
              <Stat value={review.series} label={t("Series")} />
              <Stat value={review.hours} label={t("Hours")} />
            </View>

            <View style={styles.chart} accessible accessibilityLabel={t("Activity per month")}>
              {review.months.map((count, index) => (
                <View key={index} style={styles.barSlot}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        { height: `${Math.round((count / peak) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{monthLabels[index]}</Text>
                </View>
              ))}
            </View>

            {busiestLabel ? (
              <Text style={styles.line}>
                {t("Busiest month: {{month}}", { month: busiestLabel })}
              </Text>
            ) : null}
            {review.topGenres.length > 0 ? (
              <Text style={styles.line}>
                {t("Top genres: {{genres}}", {
                  genres: review.topGenres.map((g) => t(g.name)).join(", "),
                })}
              </Text>
            ) : null}
            {review.averageRating !== null ? (
              <Text style={styles.line}>
                {t("{{count}} ratings, average {{average}}/10", {
                  count: review.ratingsGiven,
                  average: review.averageRating,
                })}
              </Text>
            ) : null}
            {review.favouriteTitle ? (
              <Text style={styles.line}>
                {t("Highest rated: {{title}} ({{score}}/10)", {
                  title: review.favouriteTitle.title,
                  score: review.favouriteTitle.score,
                })}
              </Text>
            ) : null}
          </>
        )}
        <Text style={styles.streak}>
          {t("Watch streak: {{current}} days (record {{longest}})", {
            current: streak.current,
            longest: streak.longest,
          })}
        </Text>
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: SPACING.md },
  heading: { fontFamily: FONTS.bold, fontSize: 19, color: c.textPrimary },
  card: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    gap: SPACING.md,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: SPACING.sm },
  stat: { flex: 1, gap: 2 },
  statValue: { fontFamily: FONTS.bold, fontSize: 22, color: c.textPrimary },
  statLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: c.textMuted,
  },
  chart: { flexDirection: "row", height: 90, gap: 4, alignItems: "flex-end" },
  barSlot: { flex: 1, alignItems: "center", gap: 4, height: "100%" },
  barTrack: { flex: 1, width: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", minHeight: 2, borderRadius: 3, backgroundColor: c.accent },
  barLabel: { fontFamily: FONTS.medium, fontSize: 10, color: c.textMuted },
  line: { fontFamily: FONTS.regular, fontSize: 14, color: c.textSecondary },
  muted: { fontFamily: FONTS.regular, fontSize: 14, color: c.textMuted },
  streak: { fontFamily: FONTS.semibold, fontSize: 13, color: c.textPrimary },
}));
