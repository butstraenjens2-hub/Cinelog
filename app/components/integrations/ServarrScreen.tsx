/**
 * Shared Sonarr / Radarr screen: connection settings plus library, missing
 * episodes or movies, calendar, queue and history. Hidden secrets never land
 * in the persisted settings store.
 */

import React, { useCallback, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { FloatingBackButton } from "@/components/navigation/MobileHeader";
import { Button } from "@/components/ui/Button";
import { GenrePill } from "@/components/ui/GenrePill";
import { Screen } from "@/components/ui/Screen";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { FONTS, RADIUS, SPACING } from "@/constants/theme";
import { makeStyles, useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import { readSecret, writeSecret } from "@/lib/secrets";
import { ServarrError } from "@/lib/servarr/http";
import type { SonarrListRow, SonarrStatus } from "@/lib/sonarr/api";

export interface ServarrSnapshot {
  status: SonarrStatus;
  library: SonarrListRow[];
  missing: SonarrListRow[];
  calendar: SonarrListRow[];
  queue: SonarrListRow[];
  history: SonarrListRow[];
}

type Tab = "library" | "missing" | "calendar" | "queue" | "history";

const TABS: { value: Tab; label: string }[] = [
  { value: "library", label: "Library" },
  { value: "missing", label: "Missing" },
  { value: "calendar", label: "Calendar" },
  { value: "queue", label: "Queue" },
  { value: "history", label: "History" },
];

export function ServarrScreen({
  title,
  blurb,
  url,
  onSaveUrl,
  secretKey,
  load,
}: {
  title: string;
  blurb: string;
  url: string;
  onSaveUrl: (url: string) => void;
  secretKey: string;
  load: (baseUrl: string, apiKey: string) => Promise<ServarrSnapshot>;
}) {
  const t = useT();
  const styles = useStyles();
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const [draftUrl, setDraftUrl] = useState(url);
  const [apiKey, setApiKey] = useState("");
  const [keyReady, setKeyReady] = useState(false);
  const [tab, setTab] = useState<Tab>("library");
  const [snapshot, setSnapshot] = useState<ServarrSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    let active = true;
    void readSecret(secretKey).then((stored) => {
      if (!active) return;
      setApiKey(stored);
      setKeyReady(Boolean(stored));
    });
    return () => {
      active = false;
    };
  }, [secretKey]);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      onSaveUrl(draftUrl);
      await writeSecret(secretKey, apiKey);
      setKeyReady(Boolean(apiKey.trim()));
      const next = await load(draftUrl, apiKey);
      setSnapshot(next);
    } catch (cause) {
      setSnapshot(null);
      setError(
        cause instanceof ServarrError || cause instanceof Error
          ? cause.message
          : t("Could not reach the server"),
      );
    } finally {
      setBusy(false);
    }
  }, [apiKey, draftUrl, load, onSaveUrl, secretKey, t]);

  const rows = snapshot?.[tab] ?? [];

  return (
    <Screen reserveBottomNav>
      <FloatingBackButton onPress={() => router.back()} gutter={gutter} />
      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.copy}>{blurb}</Text>

        <Text style={styles.label}>{t("Server URL")}</Text>
        <TextInput
          value={draftUrl}
          onChangeText={setDraftUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://192.168.1.20:8989"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Text style={styles.label}>{t("API key")}</Text>
        <TextInput
          value={apiKey}
          onChangeText={setApiKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder={keyReady ? "••••••••" : t("API key")}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Text style={styles.hint}>
          {t("The API key is stored in the device keystore. On the web it stays in this session only.")}
        </Text>
        <Button
          label={busy ? t("Testing connection") : t("Test connection")}
          onPress={() => void run()}
          loading={busy}
          disabled={!draftUrl.trim() || !apiKey.trim()}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {snapshot ? (
          <Text style={styles.ok}>
            {t("Connected to {{name}}", {
              name: snapshot.status.instanceName || snapshot.status.appName,
            })}
            {snapshot.status.version ? ` · ${snapshot.status.version}` : ""}
          </Text>
        ) : null}

        <View style={styles.pills}>
          {TABS.map((item) => (
            <GenrePill
              key={item.value}
              label={t(item.label)}
              selected={tab === item.value}
              onPress={() => setTab(item.value)}
            />
          ))}
        </View>

        {!snapshot && !error ? (
          <EmptyState
            icon="server-outline"
            title={t("Not configured")}
            message={t("Add the server URL and API key, then test the connection.")}
          />
        ) : error && !snapshot ? (
          <ErrorState title={t("Could not reach the server")} message={error} onRetry={() => void run()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="file-tray-outline"
            title={t("Nothing here yet")}
            message={t("This list is empty on the server.")}
          />
        ) : (
          rows.map((row) => (
            <View key={row.id} style={styles.row}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowMeta}>{row.meta}</Text>
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  body: { gap: SPACING.md, paddingTop: 96, paddingBottom: SPACING.xxl },
  title: { fontFamily: FONTS.extrabold, fontSize: 30, color: c.textPrimary },
  copy: { fontFamily: FONTS.regular, fontSize: 14, color: c.textSecondary, lineHeight: 20 },
  label: { fontFamily: FONTS.semibold, fontSize: 13, color: c.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: FONTS.regular,
    fontSize: 15,
  },
  hint: { fontFamily: FONTS.regular, fontSize: 12, color: c.textMuted, lineHeight: 17 },
  error: { fontFamily: FONTS.medium, fontSize: 13, color: c.error },
  ok: { fontFamily: FONTS.medium, fontSize: 13, color: c.success },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  row: {
    gap: 2,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  rowTitle: { fontFamily: FONTS.semibold, fontSize: 15, color: c.textPrimary },
  rowMeta: { fontFamily: FONTS.regular, fontSize: 12, color: c.textMuted },
}));
