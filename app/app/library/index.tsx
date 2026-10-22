import React, { useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";

import { useT } from "@/i18n";
import { FloatingBackButton } from "@/components/navigation/MobileHeader";
import { useIntegrationStyles } from "@/components/integrations/integrationStyles";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { useResponsive } from "@/hooks/useResponsive";
import {
  jellyfinAuthHeaders,
  jellyfinEpisodes,
  jellyfinImageUrl,
  jellyfinItems,
  jellyfinStreamUrl,
  type JellyfinItem,
} from "@/lib/jellyfin/api";
import { readSecret, SECRET } from "@/lib/secrets";
import { useIntegrations } from "@/store/integrations-store";

function OwnPlayer({ url, headers }: { url: string; headers: Record<string, string> }) {
  const player = useVideoPlayer({ uri: url, headers }, (instance) => {
    instance.play();
  });
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" }}
    />
  );
}

export default function OwnLibraryScreen() {
  const t = useT();
  const styles = useIntegrationStyles();
  const { gutter } = useResponsive();
  const url = useIntegrations((state) => state.jellyfinUrl);
  const userId = useIntegrations((state) => state.jellyfinUserId);
  const serverName = useIntegrations((state) => state.jellyfinServerName);
  const [items, setItems] = useState<JellyfinItem[]>([]);
  const [token, setToken] = useState("");
  const [playing, setPlaying] = useState<JellyfinItem | null>(null);
  const [episodes, setEpisodes] = useState<JellyfinItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [start, setStart] = useState(0);

  const load = async (startIndex: number) => {
    const saved = await readSecret(SECRET.jellyfinToken);
    if (!url.trim() || !saved || !userId) {
      router.replace("/integrations/jellyfin" as never);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const page = await jellyfinItems(url, saved, userId, startIndex);
      setToken(saved);
      setItems((current) => (startIndex === 0 ? page : [...current, ...page]));
      setStart(startIndex + page.length);
      if (!page.length && startIndex === 0) setMessage(t("Nothing in this library yet."));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    void load(0);
    // The library is loaded once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headers = token ? jellyfinAuthHeaders(token) : undefined;

  return (
    <Screen reserveBottomNav>
      <FloatingBackButton onPress={() => router.back()} gutter={gutter} />
      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        <Text style={styles.title} accessibilityRole="header">
          {serverName || t("Your library")}
        </Text>
        <Text style={styles.copy}>{t("This plays a file from your own server.")}</Text>
        {playing && headers ? (
          <View style={{ alignSelf: "stretch", gap: 8 }}>
            <OwnPlayer key={playing.id} url={jellyfinStreamUrl(url, playing)} headers={headers} />
            <Text style={styles.cardTitle}>{playing.name}</Text>
          </View>
        ) : null}
        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            {headers ? (
              <Image
                source={{ uri: jellyfinImageUrl(url, item.id), headers }}
                style={{ width: 72, height: 108, borderRadius: 8 }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : null}
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardMeta}>
              {item.kind}
              {item.year ? ` · ${item.year}` : ""}
            </Text>
            {item.kind === "Movie" || item.kind === "Episode" ? (
              <Button label={t("Play")} size="sm" onPress={() => setPlaying(item)} />
            ) : (
              <Button
                label={t("Show episodes")}
                size="sm"
                variant="secondary"
                onPress={() =>
                  void jellyfinEpisodes(url, token, userId, item.id)
                    .then(setEpisodes)
                    .catch((cause: unknown) =>
                      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server")),
                    )
                }
              />
            )}
          </View>
        ))}
        {episodes.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Button label={t("Play")} size="sm" onPress={() => setPlaying(item)} />
          </View>
        ))}
        {items.length ? (
          <Button label={t("Load more results")} variant="secondary" size="sm" loading={busy} onPress={() => void load(start)} />
        ) : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </Screen>
  );
}
