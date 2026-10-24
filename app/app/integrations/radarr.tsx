import React, { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { FloatingBackButton } from "@/components/navigation/MobileHeader";
import { useIntegrationStyles } from "@/components/integrations/integrationStyles";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/theme";
import { testRadarr } from "@/lib/radarr/api";
import { readSecret, SECRET, writeSecret } from "@/lib/secrets";
import { useIntegrations } from "@/store/integrations-store";

export default function RadarrScreen() {
  const t = useT();
  const styles = useIntegrationStyles();
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const url = useIntegrations((state) => state.radarrUrl);
  const setUrl = useIntegrations((state) => state.setRadarrUrl);
  const [draftUrl, setDraftUrl] = useState(url);
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void readSecret(SECRET.radarrApiKey).then(setApiKey);
  }, []);

  const testConnection = async () => {
    setBusy(true);
    setMessage(null);
    try {
      setUrl(draftUrl);
      await writeSecret(SECRET.radarrApiKey, apiKey);
      const status = await testRadarr(draftUrl, apiKey);
      const name = status.instanceName || status.appName;
      setMessage(status.version ? `${t("Connected to {{name}}", { name })} · ${status.version}` : t("Connected to {{name}}", { name }));
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
          Radarr
        </Text>
        <Text style={styles.copy}>
          {t(
            "Connect your own Radarr server. Movie pages can show whether a title is already in that library, and can add it. The API key stays in the device keystore. CineLog does not add indexers or download clients.",
          )}
        </Text>
        <Text style={styles.label}>{t("Server URL")}</Text>
        <TextInput
          value={draftUrl}
          onChangeText={setDraftUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://192.168.1.20:7878"
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
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Button label={t("Test connection")} loading={busy} onPress={() => void testConnection()} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </Screen>
  );
}
