/**
 * Movie or series page: plot, rating, and cast when the server sends them,
 * plus resume for a title already started.
 */

import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";

import { useT } from "@/i18n";
import { IptvFrame, useIptvStyles } from "@/components/iptv/bits";
import { IptvPlayer } from "@/components/player/IptvPlayer";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { loadXtreamDetail, xtreamPlayUrl, type IptvDetail, type IptvEpisode } from "@/lib/iptv/load";
import { readSecret } from "@/lib/secrets";
import { useIptvSession } from "@/store/iptv-session";
import { iptvPasswordKey, resumeKey, sourceAgent, sourcePlayer, useIptv } from "@/store/iptv-store";

export default function TitleDetail() {
  const t = useT();
  const styles = useIptvStyles();
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const itemId = String(params.id || "");
  const kind = params.kind === "series" ? "series" : params.kind === "movie" ? "movie" : "live";
  const sources = useIptv((state) => state.sources);
  const activeId = useIptv((state) => state.activeSourceId);
  const source = sources.find((item) => item.id === activeId) ?? null;
  const preset = useIptv((state) => state.userAgentPreset);
  const customAgent = useIptv((state) => state.userAgent);
  const globalPlayer = useIptv((state) => state.player);
  const resume = useIptv((state) => state.resume);
  const setResume = useIptv((state) => state.setResume);
  const remember = useIptv((state) => state.remember);
  const items = useIptvSession((state) => state.items);
  const item = items.find((row) => row.id === itemId && row.kind === kind) ?? null;
  const [detail, setDetail] = useState<IptvDetail | null>(null);
  const [playing, setPlaying] = useState<IptvEpisode | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!source || !item || source.kind !== "xtream" || !item.streamId) return;
    const agent = sourceAgent(source, preset, customAgent);
    void readSecret(iptvPasswordKey(source.id)).then((password) => {
      if (!password) return;
      return loadXtreamDetail(source.server, source.username, password, item, agent);
    }).then((next) => {
      if (next) setDetail(next);
    }).catch((cause: unknown) => {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    });
  }, [customAgent, item, preset, source, t]);

  if (!source || !item) {
    return (
      <IptvFrame title="IPTV">
        <Text style={styles.copy}>{t("Nothing in this category")}</Text>
        <Button label={t("Back")} variant="secondary" onPress={() => router.back()} />
      </IptvFrame>
    );
  }

  const agent = sourceAgent(source, preset, customAgent);
  const engine = sourcePlayer(source, globalPlayer);
  const playId = playing?.id || item.id;
  const position = resume[resumeKey(source.id, playing ? "series" : item.kind, playId)] || 0;
  const cover = detail?.cover || item.logo;

  const start = async (episode?: IptvEpisode, fromStart = false) => {
    try {
      let url = episode?.url || item.url;
      if (!url && source.kind === "xtream") {
        const password = await readSecret(iptvPasswordKey(source.id));
        if (!password) throw new Error(t("The saved Xtream password is missing. Add the playlist again."));
        url = xtreamPlayUrl(source.server, source.username, password, item, source.streamFormat);
      }
      if (!url) return;
      if (fromStart) setResume(resumeKey(source.id, episode ? "series" : item.kind, episode?.id || item.id), 0);
      remember({ sourceId: source.id, itemId: episode?.id || item.id, kind: episode ? "series" : item.kind, name: episode?.name || item.name, logo: item.logo, at: Date.now() });
      setPlaying({ id: episode?.id || item.id, name: episode?.name || item.name, url, plot: episode?.plot || "" });
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    }
  };

  return (
    <IptvFrame title={item.name}>
      <Text style={styles.kicker}>{item.kind === "series" ? t("Series") : t("Movies")}</Text>
      <Text style={styles.title}>{detail?.name || item.name}</Text>
      {cover ? <Image source={{ uri: cover, headers: { "User-Agent": agent } }} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 12 }} contentFit="cover" /> : null}
      {detail?.rating ? <Text style={styles.meta}>{t("Rating")}: {detail.rating}</Text> : null}
      {detail?.plot ? <Text style={styles.copy}>{detail.plot}</Text> : null}
      {detail?.cast ? <Text style={styles.meta}>{t("Cast")}: {detail.cast}</Text> : null}
      {playing ? (
        <IptvPlayer
          key={`${playing.id}-${position === 0 ? "start" : "resume"}`}
          url={playing.url}
          userAgent={agent}
          engine={engine}
          startPositionMs={position}
          onError={(text) => setMessage(t(text))}
          onProgress={(value) => {
            if (value > 15000) setResume(resumeKey(source.id, item.kind === "series" ? "series" : item.kind, playing.id), value);
          }}
        />
      ) : null}
      <View style={styles.row}>
        <Button label={position > 15000 && !playing ? t("Resume") : t("Play")} size="sm" onPress={() => void start(playing ?? undefined)} />
        {position > 15000 ? <Button label={t("Play from the start")} size="sm" variant="secondary" onPress={() => void start(undefined, true)} /> : null}
      </View>
      {message ? <Text style={styles.error}>{message}</Text> : null}
      {detail?.seasons.map((season) => (
        <View key={season.season} style={styles.card}>
          <Text style={styles.label}>{t("Seasons")} {season.season}</Text>
          {season.episodes.map((episode) => (
            <Pressable key={episode.id} style={styles.menuRow} onPress={() => void start(episode)}>
              <View style={styles.channel}>
                <Text style={styles.channelTitle}>{episode.name}</Text>
                {episode.plot ? <Text style={styles.meta} numberOfLines={2}>{episode.plot}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ))}
      <Button label={t("Back")} variant="ghost" onPress={() => router.back()} />
    </IptvFrame>
  );
}
