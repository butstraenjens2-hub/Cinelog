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
import {
  kodiEpisodes,
  kodiInput,
  kodiMovies,
  kodiNowPlaying,
  kodiPlay,
  kodiShows,
  testKodi,
  type KodiLibraryItem,
} from "@/lib/kodi/api";
import { readSecret, SECRET, writeSecret } from "@/lib/secrets";
import { useIntegrations } from "@/store/integrations-store";

const PAD = ["up", "down", "left", "right", "select", "back", "home", "playpause", "stop"] as const;

export default function KodiScreen() {
  const t = useT();
  const styles = useIntegrationStyles();
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const url = useIntegrations((state) => state.kodiUrl);
  const setUrl = useIntegrations((state) => state.setKodiUrl);
  const username = useIntegrations((state) => state.kodiUsername);
  const setUsername = useIntegrations((state) => state.setKodiUsername);
  const [draftUrl, setDraftUrl] = useState(url);
  const [draftUser, setDraftUser] = useState(username);
  const [password, setPassword] = useState("");
  const [now, setNow] = useState("");
  const [library, setLibrary] = useState<KodiLibraryItem[]>([]);
  const [episodes, setEpisodes] = useState<KodiLibraryItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    void readSecret(SECRET.kodiPassword).then(setPassword);
  }, []);

  const creds = () => ({ url: draftUrl.trim(), user: draftUser.trim(), password });

  const test = async () => {
    setBusy(true);
    setMessage(null);
    try {
      setUrl(draftUrl);
      setUsername(draftUser);
      await writeSecret(SECRET.kodiPassword, password);
      await testKodi(draftUrl, draftUser, password);
      const playing = await kodiNowPlaying(draftUrl, draftUser, password);
      setNow(playing);
      setMessage(t("Kodi is reachable."));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  };

  const send = async (action: (typeof PAD)[number]) => {
    const current = creds();
    setMessage(null);
    try {
      await kodiInput(current.url, current.user, current.password, action);
      if (action === "playpause" || action === "stop") {
        setNow(await kodiNowPlaying(current.url, current.user, current.password));
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    }
  };

  const browse = async () => {
    const current = creds();
    setBusy(true);
    setMessage(null);
    try {
      const [movies, shows] = await Promise.all([
        kodiMovies(current.url, current.user, current.password),
        kodiShows(current.url, current.user, current.password),
      ]);
      setLibrary([...movies, ...shows]);
      setEpisodes([]);
      if (!movies.length && !shows.length) setMessage(t("Nothing in this library yet."));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  };

  const playOnKodi = async (item: KodiLibraryItem) => {
    const current = creds();
    setMessage(null);
    try {
      if (item.kind === "show") {
        setEpisodes(await kodiEpisodes(current.url, current.user, current.password, item.id));
        return;
      }
      await kodiPlay(
        current.url,
        current.user,
        current.password,
        item.kind === "movie" ? { movieid: item.id } : { episodeid: item.id },
      );
      setNow(item.title);
      setMessage(t("Play on Kodi"));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    }
  };

  const labelFor = (action: (typeof PAD)[number]) => {
    if (action === "playpause") return t("Play or pause");
    if (action === "stop") return t("Stop");
    if (action === "up") return t("Up");
    if (action === "down") return t("Down");
    if (action === "left") return t("Left");
    if (action === "right") return t("Right");
    if (action === "select") return t("Select");
    if (action === "back") return t("Back");
    return t("Home");
  };

  return (
    <Screen reserveBottomNav>
      <FloatingBackButton onPress={() => router.back()} gutter={gutter} />
      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        <Text style={styles.title} accessibilityRole="header">
          {t("Kodi remote")}
        </Text>
        <Text style={styles.copy}>
          {t("Control your own Kodi player over JSON-RPC. CineLog does not install add-ons.")}
        </Text>
        <Text style={styles.label}>{t("Server URL")}</Text>
        <TextInput
          value={draftUrl}
          onChangeText={setDraftUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://192.168.1.20:8080"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Text style={styles.label}>{t("Username")}</Text>
        <TextInput
          value={draftUser}
          onChangeText={setDraftUser}
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
        <Button label={t("Test connection")} onPress={() => void test()} loading={busy} disabled={!draftUrl.trim()} />
        <Text style={styles.label}>{t("Now playing")}</Text>
        <Text style={styles.copy}>{now || t("Nothing is playing.")}</Text>
        <View style={styles.row}>
          {PAD.map((action) => (
            <Button key={action} label={labelFor(action)} variant="secondary" size="sm" onPress={() => void send(action)} />
          ))}
        </View>
        <Text style={styles.label}>{t("Library on Kodi")}</Text>
        <Button label={t("Library on Kodi")} variant="secondary" size="sm" loading={busy} onPress={() => void browse()} />
        {library.map((item) => (
          <View key={`${item.kind}-${item.id}`} style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>{item.kind === "movie" ? t("Movies") : item.kind === "show" ? t("Series") : item.meta}</Text>
            <Button
              label={item.kind === "show" ? t("Episodes") : t("Play on Kodi")}
              size="sm"
              onPress={() => void playOnKodi(item)}
            />
          </View>
        ))}
        {episodes.map((item) => (
          <View key={`episode-${item.id}`} style={styles.card}>
            <Text style={styles.cardTitle}>{item.meta ? `${item.meta} ${item.title}` : item.title}</Text>
            <Button label={t("Play on Kodi")} size="sm" onPress={() => void playOnKodi(item)} />
          </View>
        ))}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </Screen>
  );
}
