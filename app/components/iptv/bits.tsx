/**
 * Shared pieces for the viewer's own playlists.
 * The layout is original to CineLog.
 */

import React, { useState } from "react";
import { ActivityIndicator, NativeModules, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Screen } from "@/components/ui/Screen";
import { FONTS, RADIUS, SPACING } from "@/constants/theme";
import { useResponsive } from "@/hooks/useResponsive";
import { formatDownloadSize } from "@/lib/iptv/m3u.mjs";
import { useAuth } from "@/store/auth-store";
import { useIptvSession } from "@/store/iptv-session";
import { makeStyles, useTheme } from "@/theme";

export function IptvFrame({
  title,
  children,
  scroll = true,
}: {
  title: string;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const t = useT();
  const { isMobile, gutter } = useResponsive();
  const user = useAuth((state) => state.user);
  return (
    <Screen
      reserveBottomNav
      scroll={scroll}
      contentStyle={scroll ? { gap: SPACING.sm, paddingBottom: 28 } : { flex: 1 }}
      header={
        isMobile ? (
          <MobileHeader
            title={title}
            onOpenProfile={() => router.push("/profile")}
            gutter={gutter}
            displayName={user?.displayName ?? t("Guest")}
            avatarUrl={user?.avatarUrl ?? null}
          />
        ) : null
      }
    >
      <View style={{ flex: scroll ? undefined : 1, paddingHorizontal: gutter, paddingTop: SPACING.md, gap: SPACING.sm }}>
        {children}
      </View>
    </Screen>
  );
}

export function BackLink() {
  const t = useT();
  const styles = useIptvStyles();
  const { colors } = useTheme();
  return (
    <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button">
      <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
      <Text style={styles.meta}>{t("Back")}</Text>
    </Pressable>
  );
}

const KNOWN_WARNINGS = new Set(["Loaded with libVLC.", "Loaded with the Xtream API."]);

function scrubDiagnostics(text: string) {
  return text
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/password=[^\s&]*/gi, "password=(hidden)")
    .replace(/username=[^\s&]*/gi, "username=(hidden)")
    .slice(0, 6000);
}

async function writeDiagnostics(text: string) {
  const clean = scrubDiagnostics(text);
  const native = NativeModules.IptvHttp as { copyText?: (value: string) => Promise<boolean> } | undefined;
  if (native?.copyText) {
    await native.copyText(clean);
    return true;
  }
  const clipboard = (globalThis as { navigator?: { clipboard?: { writeText?: (value: string) => Promise<void> } } }).navigator?.clipboard;
  if (!clipboard?.writeText) return false;
  await clipboard.writeText(clean);
  return true;
}

function CopyDiagnostics({ text }: { text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  if (!text.trim()) return null;
  return (
    <Button
      label={copied ? t("Copied") : t("Copy diagnostics")}
      size="sm"
      variant="secondary"
      onPress={() => {
        void writeDiagnostics(text)
          .then((ok) => {
            if (!ok) return;
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          })
          .catch(() => undefined);
      }}
    />
  );
}

function warningText(warnings: string[], t: (key: string) => string) {
  return warnings.map((line) => (KNOWN_WARNINGS.has(line) ? t(line) : line)).join("\n");
}

export function LoadBanner({ onCancel, onRetry }: { onCancel: () => void; onRetry: () => void }) {
  const t = useT();
  const styles = useIptvStyles();
  const session = useIptvSession();
  const [open, setOpen] = useState(false);
  if (session.phase === "download" || session.phase === "parsing") {
    const label = session.note
      ? t(session.note)
      : session.phase === "parsing"
        ? t("Parsing {{count}} channels", { count: session.parsed })
        : t("Downloading {{size}}", { size: formatDownloadSize(session.bytes) });
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <ActivityIndicator />
          <Text style={styles.copy}>{label}</Text>
        </View>
        <Button label={t("Cancel")} size="sm" variant="secondary" onPress={onCancel} />
      </View>
    );
  }
  if (session.phase === "error" && session.error) {
    return (
      <View style={styles.card}>
        <Text style={styles.error}>{t(session.error)}</Text>
        <View style={styles.row}>
          <CopyDiagnostics text={session.report || session.error} />
          <Button label={t("Retry")} size="sm" onPress={onRetry} />
        </View>
      </View>
    );
  }
  if (session.phase === "ready" && session.diagnosis) {
    const { diagnosis } = session;
    const parts = [t("The playlist has no entries.")];
    if (diagnosis.status) parts.push(t("HTTP {{status}}", { status: diagnosis.status }));
    if (diagnosis.contentType) parts.push(diagnosis.contentType);
    if (diagnosis.reason) parts.push(t(diagnosis.reason));
    if (diagnosis.snippet && diagnosis.snippet !== diagnosis.reason && !diagnosis.reason.includes(diagnosis.snippet)) {
      parts.push(diagnosis.snippet);
    }
    return (
      <View style={styles.card}>
        <Text style={styles.error}>{parts.join(" ")}</Text>
        <View style={styles.row}>
          <Button label={open ? t("Hide details") : t("Show details")} size="sm" variant="secondary" onPress={() => setOpen((value) => !value)} />
          <CopyDiagnostics text={session.report || diagnosis.details.join("\n")} />
          <Button label={t("Retry")} size="sm" onPress={onRetry} />
        </View>
        {open ? <Text style={styles.diag} selectable>{diagnosis.details.join("\n")}</Text> : null}
      </View>
    );
  }
  if (session.warnings.length || session.report) {
    return (
      <View style={styles.card}>
        {session.warnings.length ? <Text style={styles.copy}>{warningText(session.warnings, t)}</Text> : null}
        <CopyDiagnostics text={session.report} />
      </View>
    );
  }
  return null;
}

export function sectionTitle(section: string, counts: { live: number; movie: number; series: number }, t: (key: string, values?: Record<string, string | number>) => string) {
  if (section === "movie") return t("Movies {{count}}", { count: counts.movie });
  if (section === "series") return t("Series {{count}}", { count: counts.series });
  if (section === "favorites") return t("Favorites");
  if (section === "recent") return t("Recently watched");
  return t("Live {{count}}", { count: counts.live });
}

export const useIptvStyles = makeStyles((c) => ({
  back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
  kicker: { fontFamily: FONTS.medium, fontSize: 11, color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  title: { fontFamily: FONTS.bold, fontSize: 22, color: c.textPrimary },
  copy: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, color: c.textSecondary, flex: 1 },
  error: { fontFamily: FONTS.medium, fontSize: 13, lineHeight: 18, color: c.error },
  diag: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, color: c.textSecondary },
  meta: { fontFamily: FONTS.regular, fontSize: 12, color: c.textMuted },
  label: { fontFamily: FONTS.semibold, fontSize: 13, color: c.textPrimary },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  card: {
    alignSelf: "stretch",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  tile: {
    flex: 1,
    minWidth: 140,
    gap: 4,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  tileTitle: { fontFamily: FONTS.semibold, fontSize: 15, color: c.textPrimary },
  input: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.background,
    color: c.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: FONTS.regular,
    fontSize: 15,
  },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  chipOn: { borderColor: c.accent, backgroundColor: c.surfaceHover },
  chipText: { fontFamily: FONTS.medium, fontSize: 12, color: c.textPrimary, maxWidth: 180 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  menuRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  logo: { width: 72, height: 48, borderRadius: RADIUS.sm, backgroundColor: c.background },
  channel: { flex: 1, gap: 2 },
  channelTitle: { fontFamily: FONTS.semibold, fontSize: 15, color: c.textPrimary },
}));
