import React, { useState } from "react";
import { Linking, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { FloatingBackButton } from "@/components/navigation/MobileHeader";
import { useIntegrationStyles } from "@/components/integrations/integrationStyles";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/theme";
import { SECRET, writeSecret } from "@/lib/secrets";
import { pollSimklDevice, startSimklDevice } from "@/lib/simkl/api";
import { pullSimklLibrary, pushSimklProgressFromDevice, pushSimklWatchlistFromDevice } from "@/lib/simkl/sync";
import { useIntegrations } from "@/store/integrations-store";

export default function SimklScreen() {
  const t = useT();
  const styles = useIntegrationStyles();
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const clientId = useIntegrations((state) => state.simklClientId);
  const setClientId = useIntegrations((state) => state.setSimklClientId);
  const setExpires = useIntegrations((state) => state.setSimklExpiresAt);
  const [draftId, setDraftId] = useState(clientId);
  const [userCode, setUserCode] = useState("");
  const [verifyUrl, setVerifyUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      setClientId(draftId);
      const device = await startSimklDevice(draftId.trim());
      setUserCode(device.userCode);
      setVerifyUrl(device.verificationUrl);
      const deadline = Date.now() + device.expiresIn * 1000;
      const interval = Math.max(device.interval, 5) * 1000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, interval));
        const result = await pollSimklDevice(draftId.trim(), device.deviceCode);
        if (result !== "pending") {
          await writeSecret(SECRET.simklAccessToken, result.accessToken);
          if (result.refreshToken) await writeSecret(SECRET.simklRefreshToken, result.refreshToken);
          setExpires(Date.now() + result.expiresIn * 1000);
          setUserCode("");
          setMessage(t("SIMKL is connected."));
          return;
        }
      }
      setMessage(t("The SIMKL code expired. Try again."));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  };

  const run = async (task: () => Promise<{ watchlist: number; progress: number } | void>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await task();
      if (result && typeof result === "object") {
        setMessage(
          t("{{watchlist}} watchlist titles and {{progress}} watched items updated from SIMKL.", result),
        );
      } else {
        setMessage(t(done));
      }
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
          SIMKL
        </Text>
        <Text style={styles.copy}>
          {t(
            "Sync your watchlist with your own SIMKL application. Create a client at simkl.com and paste the client ID. CineLog does not ship a shared SIMKL secret.",
          )}
        </Text>
        <Text style={styles.label}>{t("SIMKL client ID")}</Text>
        <TextInput
          value={draftId}
          onChangeText={setDraftId}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Button label={t("Connect SIMKL")} onPress={() => void connect()} loading={busy} disabled={!draftId.trim()} />
        {userCode ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.title}>{userCode}</Text>
            <Text style={styles.copy}>{t("Enter this code on SIMKL")}</Text>
            <Button label={t("Open SIMKL")} variant="secondary" size="sm" onPress={() => void Linking.openURL(verifyUrl)} />
          </View>
        ) : null}
        <Button
          label={t("Pull from SIMKL")}
          variant="secondary"
          size="sm"
          onPress={() => void run(pullSimklLibrary, "SIMKL is connected.")}
        />
        <Button
          label={t("Push watchlist to SIMKL")}
          variant="secondary"
          size="sm"
          onPress={() => void run(pushSimklWatchlistFromDevice, "Watchlist sent to SIMKL.")}
        />
        <Button
          label={t("Push watched progress to SIMKL")}
          variant="secondary"
          size="sm"
          onPress={() => void run(pushSimklProgressFromDevice, "Watched progress sent to SIMKL.")}
        />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </Screen>
  );
}
