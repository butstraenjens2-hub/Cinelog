/**
 * CineLog — import your Letterboxd history.
 *
 * Pick one or more CSV files from the Letterboxd export (watched, ratings,
 * diary, watchlist). Every film is matched on TMDB and merged into the local
 * library without overwriting anything you already tracked.
 */

import React, { useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

import { useT } from "@/i18n";
import { SeoHead } from "@/components/SeoHead";
import { FloatingBackButton } from "@/components/navigation/MobileHeader";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { FONTS, RADIUS, SPACING } from "@/constants/theme";
import { makeStyles } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import {
  mapLimited,
  matchLetterboxdRow,
  parseLetterboxd,
  type ParsedLetterboxd,
} from "@/lib/cinelog/letterboxd";
import { toLibraryRef, useLibrary, type ImportEntry } from "@/store/library-store";

/** Keeps a huge export from hammering the API in one go. */
const MAX_ROWS = 1500;

type Phase = "idle" | "matching" | "done" | "error";

async function readAsset(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (asset.file) return asset.file.text(); // web
  return new File(asset.uri).text();
}

export default function ImportScreen() {
  const t = useT();
  const styles = useStyles();
  const { gutter } = useResponsive();
  const importEntries = useLibrary((state) => state.importEntries);

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState({ imported: 0, unmatched: 0 });
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const cancelled = useRef(false);

  const pick = async () => {
    setMessage(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "text/comma-separated-values", "text/plain", "*/*"],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || result.assets.length === 0) return;

    const files: ParsedLetterboxd[] = [];
    try {
      for (const asset of result.assets) {
        files.push(parseLetterboxd(await readAsset(asset), asset.name));
      }
    } catch {
      setPhase("error");
      setMessage(t("That file doesn't look like a Letterboxd CSV export."));
      return;
    }

    // One lookup per unique film, however many files mention it.
    const unique = new Map<string, { name: string; year: number | null }>();
    for (const file of files) {
      for (const row of file.rows) {
        unique.set(`${row.name.toLowerCase()}|${row.year ?? ""}`, row);
      }
    }
    const lookups = [...unique.entries()].slice(0, MAX_ROWS);
    cancelled.current = false;
    setPhase("matching");
    setProgress({ done: 0, total: lookups.length });

    const matches = await mapLimited(
      lookups,
      4,
      async ([, row]) => {
        try {
          return await matchLetterboxdRow({ ...row, date: null, score: null });
        } catch {
          return null;
        }
      },
      (done) => setProgress({ done, total: lookups.length }),
      () => cancelled.current,
    );
    const byKey = new Map(lookups.map(([key], index) => [key, matches[index] ?? null]));

    const entries: ImportEntry[] = [];
    const missed = new Set<string>();
    for (const file of files) {
      for (const row of file.rows) {
        const key = `${row.name.toLowerCase()}|${row.year ?? ""}`;
        if (!byKey.has(key)) continue; // beyond MAX_ROWS or cancelled
        const match = byKey.get(key);
        if (!match) {
          missed.add(row.year ? `${row.name} (${row.year})` : row.name);
          continue;
        }
        const item = toLibraryRef(match);
        if (file.kind === "watchlist") {
          entries.push({ item, kind: "watchlist", date: row.date });
        } else {
          if (file.kind === "watched" || row.date) {
            entries.push({ item, kind: "watched", date: row.date });
          }
          if (row.score) {
            entries.push({ item, kind: "rating", date: row.date, score: row.score });
          }
        }
      }
    }
    importEntries(entries);
    setSummary({
      imported: new Set(entries.map((e) => e.item.id)).size,
      unmatched: missed.size,
    });
    setUnmatched([...missed].slice(0, 30));
    setPhase("done");
  };

  return (
    <>
      <SeoHead title={t("Import from Letterboxd")} />
      <Screen reserveBottomNav>
        <FloatingBackButton onPress={() => router.back()} gutter={gutter} />
        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          <Text style={styles.title} accessibilityRole="header">
            {t("Import from Letterboxd")}
          </Text>
          <Text style={styles.copy}>
            {t(
              "Export your data on letterboxd.com (Settings → Import & Export), unzip it and pick watched.csv, ratings.csv, diary.csv and/or watchlist.csv.",
            )}
          </Text>
          <Button
            label={t("Open Letterboxd export page")}
            icon="open-outline"
            variant="secondary"
            size="sm"
            onPress={() =>
              void Linking.openURL("https://letterboxd.com/settings/data/").catch(() => undefined)
            }
          />

          {phase === "matching" ? (
            <View style={styles.card}>
              <Text style={styles.copy}>
                {t("Matching films… {{done}}/{{total}}", progress)}
              </Text>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                    },
                  ]}
                />
              </View>
              <Button
                label={t("Stop")}
                variant="secondary"
                size="sm"
                onPress={() => {
                  cancelled.current = true;
                }}
              />
            </View>
          ) : (
            <Button label={t("Choose CSV files")} icon="document-text-outline" onPress={() => void pick()} />
          )}

          {message ? <Text style={styles.error}>{message}</Text> : null}

          {phase === "done" ? (
            <View style={styles.card}>
              <Text style={styles.strong}>
                {t("{{count}} films imported", { count: summary.imported })}
              </Text>
              {summary.unmatched > 0 ? (
                <>
                  <Text style={styles.copy}>
                    {t("{{count}} could not be matched:", { count: summary.unmatched })}
                  </Text>
                  <Text style={styles.muted}>{unmatched.join(" · ")}</Text>
                </>
              ) : null}
              <Button
                label={t("View profile")}
                variant="secondary"
                size="sm"
                onPress={() => router.replace("/profile")}
              />
            </View>
          ) : null}

        </View>
      </Screen>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  body: { gap: SPACING.lg, paddingTop: SPACING.xxxl * 1.5 },
  title: { fontFamily: FONTS.bold, fontSize: 26, color: c.textPrimary },
  copy: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: c.textSecondary },
  strong: { fontFamily: FONTS.semibold, fontSize: 16, color: c.textPrimary },
  muted: { fontFamily: FONTS.regular, fontSize: 12, color: c.textMuted },
  error: { fontFamily: FONTS.medium, fontSize: 14, color: c.accent },
  card: {
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  track: { height: 6, borderRadius: 3, backgroundColor: c.border, overflow: "hidden" },
  fill: { height: 6, backgroundColor: c.accent },
}));
