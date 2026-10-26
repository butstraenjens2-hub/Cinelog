import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { FloatingBackButton } from "@/components/navigation/MobileHeader";
import { useIntegrationStyles } from "@/components/integrations/integrationStyles";
import { Button } from "@/components/ui/Button";
import { GenrePill } from "@/components/ui/GenrePill";
import { Screen } from "@/components/ui/Screen";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/theme";
import {
  jellyfinSignIn,
  jellyfinSystem,
  jellyfinUserId,
} from "@/lib/jellyfin/api";
import { readSecret, SECRET, writeSecret } from "@/lib/secrets";
import { useIntegrations, type LibraryServerKind } from "@/store/integrations-store";

export default function JellyfinScreen() {
  const t = useT();
  const styles = useIntegrationStyles();
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const url = useIntegrations((state) => state.jellyfinUrl);
  const setUrl = useIntegrations((state) => state.setJellyfinUrl);
  const kind = useIntegrations((state) => state.libraryServerKind);
  const setKind = useIntegrations((state) => state.setLibraryServerKind);
  const setUserId = useIntegrations((state) => state.setJellyfinUserId);
  const setServerName = useIntegrations((state) => state.setJellyfinServerName);
  const serverName = useIntegrations((state) => state.jellyfinServerName);
  const [draftUrl, setDraftUrl] = useState(url);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    void readSecret(SECRET.jellyfinToken).then((token) => {
      if (token && !password) setApiKey("");
    });
  }, [password]);

  const saveSession = async (token: string, userId: string, name: string) => {
    setUrl(draftUrl);
    setUserId(userId);
    setServerName(name);
    await writeSecret(SECRET.jellyfinToken, token);
    setMessage(t("Signed in to {{name}}", { name }));
  };

  const signIn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const session = await jellyfinSignIn(draftUrl, username, password);
      await saveSession(session.token, session.userId, session.serverName);
      setPassword("");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  };

  const saveKey = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const info = await jellyfinSystem(draftUrl, apiKey.trim());
      const userId = await jellyfinUserId(draftUrl, apiKey.trim());
      await saveSession(apiKey.trim(), userId, info.serverName);
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
          {t("Jellyfin or Emby")}
        </Text>
        <Text style={styles.copy}>
          {t("Play movies and series from your own Jellyfin or Emby server. CineLog only talks to the server you enter.")}
        </Text>
        <View style={styles.row}>
          {(["jellyfin", "emby"] as LibraryServerKind[]).map((option) => (
            <GenrePill
              key={option}
              label={option === "jellyfin" ? "Jellyfin" : "Emby"}
              selected={kind === option}
              onPress={() => setKind(option)}
            />
          ))}
        </View>
        <Text style={styles.label}>{t("Server URL")}</Text>
        <TextInput
          value={draftUrl}
          onChangeText={setDraftUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://192.168.1.20:8096"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Text style={styles.label}>{t("Username")}</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Text style={styles.label}>{t("Password")}</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Button
          label={t("Sign in and save")}
          onPress={() => void signIn()}
          loading={busy}
          disabled={!draftUrl.trim() || !username.trim()}
        />
        <Text style={styles.label}>{t("API key instead")}</Text>
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
        <Button
          label={t("Test connection")}
          variant="secondary"
          onPress={() => void saveKey()}
          loading={busy}
          disabled={!draftUrl.trim() || !apiKey.trim()}
        />
        {serverName ? <Text style={styles.message}>{t("Signed in to {{name}}", { name: serverName })}</Text> : null}
        <Button
          label={t("Open library")}
          icon="chevron-forward"
          variant="secondary"
          onPress={() => router.push("/library" as never)}
        />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </Screen>
  );
}
