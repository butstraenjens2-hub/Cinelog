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
import { tautulliActivity, tautulliHistory, tautulliStats, testTautulli, type TautulliRow } from "@/lib/tautulli/api";
import { readSecret, SECRET, writeSecret } from "@/lib/secrets";
import { useIntegrations } from "@/store/integrations-store";

function Rows({ rows, empty }: { rows: TautulliRow[]; empty: string }) {
  const styles = useIntegrationStyles();
  if (!rows.length) return <Text style={styles.hint}>{empty}</Text>;
  return (
    <>
      {rows.map((row) => (
        <View key={row.id} style={styles.card}>
          <Text style={styles.cardTitle}>{row.title}</Text>
          {row.meta ? <Text style={styles.cardMeta}>{row.meta}</Text> : null}
        </View>
      ))}
    </>
  );
}

export default function TautulliScreen() {
  const t = useT();
  const styles = useIntegrationStyles();
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const url = useIntegrations((state) => state.tautulliUrl);
  const setUrl = useIntegrations((state) => state.setTautulliUrl);
  const [draftUrl, setDraftUrl] = useState(url);
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [activity, setActivity] = useState<TautulliRow[]>([]);
  const [stats, setStats] = useState<TautulliRow[]>([]);
  const [history, setHistory] = useState<TautulliRow[]>([]);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    void readSecret(SECRET.tautulliApiKey).then(setApiKey);
  }, []);

  const load = async () => {
    setBusy(true);
    setMessage(null);
    try {
      setUrl(draftUrl);
      await writeSecret(SECRET.tautulliApiKey, apiKey);
      const name = await testTautulli(draftUrl, apiKey);
      const [now, home, recent] = await Promise.all([
        tautulliActivity(draftUrl, apiKey),
        tautulliStats(draftUrl, apiKey),
        tautulliHistory(draftUrl, apiKey),
      ]);
      setActivity(now);
      setStats(home);
      setHistory(recent);
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
          Tautulli
        </Text>
        <Text style={styles.copy}>
          {t("Read-only stats from your own Tautulli server. CineLog cannot stop a stream or change Plex.")}
        </Text>
        <Text style={styles.label}>{t("Server URL")}</Text>
        <TextInput
          value={draftUrl}
          onChangeText={setDraftUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://192.168.1.20:8181"
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
        <Button label={t("Test connection")} onPress={() => void load()} loading={busy} disabled={!draftUrl.trim() || !apiKey.trim()} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Text style={styles.label}>{t("Now playing")}</Text>
        <Rows rows={activity} empty={t("Nobody is watching.")} />
        <Text style={styles.label}>{t("Home stats")}</Text>
        <Rows rows={stats} empty={t("Nothing here yet")} />
        <Text style={styles.label}>{t("Recent plays")}</Text>
        <Rows rows={history} empty={t("Nothing here yet")} />
      </View>
    </Screen>
  );
}
