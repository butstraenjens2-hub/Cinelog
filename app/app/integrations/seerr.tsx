import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { FloatingBackButton } from "@/components/navigation/MobileHeader";
import { useIntegrationStyles } from "@/components/integrations/integrationStyles";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/theme";
import { testSeerr } from "@/lib/seerr/api";
import { readSecret, SECRET, writeSecret } from "@/lib/secrets";
import { useIntegrations } from "@/store/integrations-store";

export default function SeerrScreen() {
  const t = useT();
  const styles = useIntegrationStyles();
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const url = useIntegrations((state) => state.seerrUrl);
  const setUrl = useIntegrations((state) => state.setSeerrUrl);
  const [draftUrl, setDraftUrl] = useState(url);
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    void readSecret(SECRET.seerrApiKey).then(setApiKey);
  }, []);

  const test = async () => {
    setBusy(true);
    setMessage(null);
    try {
      setUrl(draftUrl);
      await writeSecret(SECRET.seerrApiKey, apiKey);
      const name = await testSeerr(draftUrl, apiKey);
      setMessage(t("Connected to {{name}}", { name }));
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
          {t("Seerr or Overseerr")}
        </Text>
        <Text style={styles.copy}>
          {t("Request a movie or series on your own Seerr or Overseerr server. CineLog does not choose indexers or download clients.")}
        </Text>
        <Text style={styles.label}>{t("Server URL")}</Text>
        <TextInput
          value={draftUrl}
          onChangeText={setDraftUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://192.168.1.20:5055"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Text style={styles.label}>{t("API key")}</Text>
        <TextInput
          value={apiKey}
          onChangeText={setApiKey}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Text style={styles.hint}>
          {t("The API key is stored in the device keystore. On the web it stays in this session only.")}
        </Text>
        <Button label={t("Test connection")} onPress={() => void test()} loading={busy} disabled={!draftUrl.trim() || !apiKey.trim()} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </Screen>
  );
}
