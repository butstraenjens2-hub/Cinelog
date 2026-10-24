/**
 * Dashboard for the playlist the viewer just opened.
 */

import React, { useEffect } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { IptvFrame, LoadBanner, useIptvStyles } from "@/components/iptv/bits";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { cancelRefresh, refreshPlaylist } from "@/lib/iptv/refresh";
import { useIptvSession } from "@/store/iptv-session";
import { useIptv } from "@/store/iptv-store";

export default function PlaylistHome() {
  const t = useT();
  const styles = useIptvStyles();
  const sources = useIptv((state) => state.sources);
  const activeId = useIptv((state) => state.activeSourceId);
  const setActive = useIptv((state) => state.setActiveSource);
  const source = sources.find((item) => item.id === activeId) ?? null;
  const session = useIptvSession();
  const counts = session.sourceId === source?.id && session.phase === "ready" ? session.counts : source?.counts;

  useEffect(() => {
    const next = useIptv.getState().sources.find((item) => item.id === activeId);
    if (!next) return;
    const current = useIptvSession.getState();
    if (current.sourceId === next.id && current.phase !== "idle") return;
    void refreshPlaylist(next);
  }, [activeId]);

  if (!source) {
    return (
      <IptvFrame title="IPTV">
        <Text style={styles.copy}>{t("No playlist yet")}</Text>
        <Button label={t("Playlists")} onPress={() => router.replace("/(tabs)/iptv")} />
      </IptvFrame>
    );
  }

  const tiles = [
    ["live", t("Live TV"), counts ? t("Live {{count}}", { count: counts.live }) : ""],
    ["movie", t("Movies"), counts ? t("Movies {{count}}", { count: counts.movie }) : ""],
    ["series", t("Series"), counts ? t("Series {{count}}", { count: counts.series }) : ""],
    ["guide", t("Catch-up guide"), t("Guide")],
    ["favorites", t("Favorites"), ""],
    ["recent", t("Recently watched"), ""],
    ["account", t("Account info"), source.account?.status || ""],
    ["settings", t("Settings"), ""],
  ] as const;

  return (
    <IptvFrame title={source.name}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{source.kind === "xtream" ? t("Xtream login") : t("M3U playlist")}</Text>
          <Text style={styles.title} numberOfLines={1}>{source.name}</Text>
          <Text style={styles.meta}>
            {source.updatedAt ? t("Updated {{time}}", { time: new Date(source.updatedAt).toLocaleString() }) : t("Not loaded yet")}
          </Text>
        </View>
        <Button label={t("Refresh playlist")} size="sm" variant="secondary" onPress={() => void refreshPlaylist(source)} />
      </View>
      <LoadBanner onCancel={cancelRefresh} onRetry={() => void refreshPlaylist(source)} />
      <View style={styles.grid}>
        {tiles.map(([id, label, hint]) => (
          <Pressable
            key={id}
            style={styles.tile}
            onPress={() => {
              if (id === "guide") router.push("/(tabs)/iptv/guide");
              else if (id === "account") router.push("/(tabs)/iptv/account");
              else if (id === "settings") router.push("/(tabs)/iptv/settings");
              else router.push({ pathname: "/(tabs)/iptv/browse", params: { section: id } });
            }}
          >
            <Text style={styles.tileTitle}>{label}</Text>
            {hint ? <Text style={styles.meta}>{hint}</Text> : null}
          </Pressable>
        ))}
      </View>
      {sources.length > 1 ? (
        <View style={styles.card}>
          <Text style={styles.label}>{t("Switch playlist")}</Text>
          {sources.filter((item) => item.id !== source.id).map((item) => (
            <Pressable
              key={item.id}
              style={styles.menuRow}
              onPress={() => {
                setActive(item.id);
                void refreshPlaylist(item);
              }}
            >
              <Text style={styles.channelTitle}>{item.name}</Text>
              <Text style={styles.meta}>{item.kind === "xtream" ? "Xtream" : "M3U"}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Button label={t("Playlists")} variant="secondary" onPress={() => router.push("/(tabs)/iptv")} />
    </IptvFrame>
  );
}
