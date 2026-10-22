/**
 * Catch-up and the XMLTV guide for the open playlist.
 */

import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { IptvFrame, useIptvStyles } from "@/components/iptv/bits";
import { IptvPlayer } from "@/components/player/IptvPlayer";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { currentAndNext } from "@/lib/iptv/guide.mjs";
import { loadGuide, xtreamCatchupPlayUrl } from "@/lib/iptv/load";
import { readSecret } from "@/lib/secrets";
import { useIptvSession } from "@/store/iptv-session";
import { iptvPasswordKey, sourceAgent, sourcePlayer, useIptv } from "@/store/iptv-store";

export default function GuideScreen() {
  const t = useT();
  const styles = useIptvStyles();
  const sources = useIptv((state) => state.sources);
  const activeId = useIptv((state) => state.activeSourceId);
  const source = sources.find((item) => item.id === activeId) ?? null;
  const preset = useIptv((state) => state.userAgentPreset);
  const customAgent = useIptv((state) => state.userAgent);
  const globalPlayer = useIptv((state) => state.player);
  const items = useIptvSession((state) => (state.sourceId === activeId ? state.items : []));
  const programmes = useIptvSession((state) => state.programmes);
  const guideUrl = useIptvSession((state) => state.guideUrl);
  const [playing, setPlaying] = useState("");
  const [message, setMessage] = useState("");
  const live = items.filter((item) => item.kind === "live").slice(0, 80);

  useEffect(() => {
    if (!source?.xmltvUrl || guideUrl === source.xmltvUrl) return;
    const agent = sourceAgent(source, preset, customAgent);
    void loadGuide(source.xmltvUrl, agent)
      .then((parsed) => useIptvSession.getState().setGuide(source.xmltvUrl, parsed.programmes))
      .catch((cause: unknown) => setMessage(cause instanceof Error ? cause.message : t("Could not reach the server")));
  }, [customAgent, guideUrl, preset, source, t]);

  if (!source) {
    return (
      <IptvFrame title={t("Guide")}>
        <Button label={t("Playlists")} onPress={() => router.replace("/(tabs)/iptv")} />
      </IptvFrame>
    );
  }

  return (
    <IptvFrame title={t("Catch-up guide")}>
      <Text style={styles.title}>{t("Catch-up guide")}</Text>
      <Text style={styles.meta}>
        {source.updatedAt ? t("Updated {{time}}", { time: new Date(source.updatedAt).toLocaleString() }) : t("Not loaded yet")}
      </Text>
      {!source.xmltvUrl ? <Text style={styles.copy}>{t("No guide URL for this playlist.")}</Text> : null}
      {message ? <Text style={styles.error}>{message}</Text> : null}
      {playing ? (
        <IptvPlayer url={playing} userAgent={sourceAgent(source, preset, customAgent)} engine={sourcePlayer(source, globalPlayer)} />
      ) : null}
      {live.map((item) => {
        const guide = item.tvgId ? currentAndNext(programmes, item.tvgId, Date.now(), source.epgOffsetHours) : null;
        return (
          <View key={item.id} style={styles.card}>
            <Text style={styles.channelTitle}>{item.name}</Text>
            <Text style={styles.meta}>{t("Current")}: {guide?.current?.title || "—"}</Text>
            <Text style={styles.meta}>{t("Next")}: {guide?.next?.title || "—"}</Text>
            {item.archiveHours > 0 ? (
              <Pressable onPress={() => {
                void readSecret(iptvPasswordKey(source.id)).then((password) => {
                  if (!password) return;
                  const minutes = Math.min(60, item.archiveHours * 60);
                  setPlaying(xtreamCatchupPlayUrl(source.server, source.username, password, item, minutes));
                });
              }}>
                <Text style={styles.label}>{t("Catch-up")}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      <Button label={t("Back")} variant="ghost" onPress={() => router.back()} />
    </IptvFrame>
  );
}
