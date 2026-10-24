import React, { useState } from "react";
import { Linking, Switch, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { FloatingBackButton } from "@/components/navigation/MobileHeader";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { FONTS, RADIUS, SPACING } from "@/constants/theme";
import { makeStyles, useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import { readSecret, SECRET, writeSecret } from "@/lib/secrets";
import { pollTraktDevice, startTraktDevice } from "@/lib/trakt/api";
import {
  pullTraktPlaybackPositions,
  pullTraktProgress,
  pullTraktWatchlist,
  pushLocalProgress,
  pushLocalWatchlist,
} from "@/lib/trakt/sync";
import { useIntegrations } from "@/store/integrations-store";

export default function TraktScreen() {
  const t = useT();
  const styles = useStyles();
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const clientId = useIntegrations((state) => state.traktClientId);
  const setClientId = useIntegrations((state) => state.setTraktClientId);
  const syncWatchlist = useIntegrations((state) => state.traktSyncWatchlist);
  const syncProgress = useIntegrations((state) => state.traktSyncProgress);
  const setSyncWatchlist = useIntegrations((state) => state.setTraktSyncWatchlist);
  const setSyncProgress = useIntegrations((state) => state.setTraktSyncProgress);
  const [draftId, setDraftId] = useState(clientId);
  const [secret, setSecret] = useState("");
  const [userCode, setUserCode] = useState("");
  const [verifyUrl, setVerifyUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    void readSecret(SECRET.traktClientSecret).then(setSecret);
  }, []);

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      setClientId(draftId);
      await writeSecret(SECRET.traktClientSecret, secret);
      const device = await startTraktDevice(draftId.trim());
      setUserCode(device.userCode);
      setVerifyUrl(device.verificationUrl);
      const deadline = Date.now() + device.expiresIn * 1000;
      const interval = Math.max(device.interval, 5) * 1000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, interval));
        const result = await pollTraktDevice(draftId.trim(), secret.trim(), device.deviceCode);
        if (result === "granted") {
          setMessage(t("Trakt is connected."));
          setUserCode("");
          return;
        }
      }
      setMessage(t("The Trakt code expired. Try again."));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  };

  const run = async (task: () => Promise<number | void>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const count = await task();
      setMessage(typeof count === "number" ? t(done, { count }) : t(done, { count: 0 }));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen reserveBottomNav>
      <FloatingBackButton onPress={() => router.back()} gutter={gutter} />
      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        <Text style={styles.title} accessibilityRole="header">
          Trakt
        </Text>
        <Text style={styles.copy}>
          {t(
            "Sync your watchlist and watched progress with your own Trakt account. Create a personal API app at trakt.tv and paste the client ID and secret here. CineLog does not ship a shared Trakt secret.",
          )}
        </Text>
        <Text style={styles.label}>{t("Trakt client ID")}</Text>
        <TextInput
          value={draftId}
          onChangeText={setDraftId}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Text style={styles.label}>{t("Client secret")}</Text>
        <TextInput
          value={secret}
          onChangeText={setSecret}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Text style={styles.hint}>
          {t("The client secret and tokens are stored in the device keystore.")}
        </Text>
        <Button
          label={t("Connect Trakt")}
          onPress={() => void connect()}
          loading={busy}
          disabled={!draftId.trim() || !secret.trim()}
        />
        {userCode ? (
          <View style={styles.codeBox}>
            <Text style={styles.code}>{userCode}</Text>
            <Text style={styles.copy}>{t("Enter this code on Trakt")}</Text>
            <Button
              label={t("Open Trakt")}
              variant="secondary"
              size="sm"
              onPress={() => void Linking.openURL(verifyUrl)}
            />
          </View>
        ) : null}

        <View style={styles.toggle}>
          <Text style={styles.copy}>{t("Keep watchlist in sync")}</Text>
          <Switch
            value={syncWatchlist}
            onValueChange={setSyncWatchlist}
            trackColor={{ false: colors.surfaceHover, true: colors.accent }}
          />
        </View>
        <View style={styles.toggle}>
          <Text style={styles.copy}>{t("Keep progress in sync")}</Text>
          <Switch
            value={syncProgress}
            onValueChange={setSyncProgress}
            trackColor={{ false: colors.surfaceHover, true: colors.accent }}
          />
        </View>

        <Button
          label={t("Push watchlist to Trakt")}
          variant="secondary"
          size="sm"
          onPress={() => void run(pushLocalWatchlist, "Watchlist sent to Trakt.")}
        />
        <Button
          label={t("Pull watchlist from Trakt")}
          variant="secondary"
          size="sm"
          onPress={() => void run(pullTraktWatchlist, "{{count}} titles added from Trakt.")}
        />
        <Button
          label={t("Push watched progress")}
          variant="secondary"
          size="sm"
          onPress={() => void run(pushLocalProgress, "Watched progress sent to Trakt.")}
        />
        <Button
          label={t("Pull watched progress")}
          variant="secondary"
          size="sm"
          onPress={() => void run(pullTraktProgress, "{{count}} watched items updated from Trakt.")}
        />
        <Button
          label={t("Pull playback positions")}
          variant="secondary"
          size="sm"
          onPress={() =>
            void run(pullTraktPlaybackPositions, "{{count}} playback positions restored.")
          }
        />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  body: { gap: SPACING.md, paddingTop: 96, paddingBottom: SPACING.xxl, alignItems: "flex-start" },
  title: { fontFamily: FONTS.extrabold, fontSize: 30, color: c.textPrimary },
  copy: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: c.textSecondary },
  label: { fontFamily: FONTS.semibold, fontSize: 13, color: c.textPrimary },
  input: {
    alignSelf: "stretch",
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
  hint: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, color: c.textMuted },
  codeBox: { gap: SPACING.sm, alignItems: "flex-start" },
  code: { fontFamily: FONTS.extrabold, fontSize: 28, letterSpacing: 4, color: c.textPrimary },
  toggle: { flexDirection: "row", alignItems: "center", gap: SPACING.md, alignSelf: "stretch" },
  message: { fontFamily: FONTS.medium, fontSize: 13, color: c.textPrimary },
}));
