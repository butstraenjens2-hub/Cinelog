/**
 * Live, movies, series, favorites, and recently watched for one playlist.
 * Counts stay on the section tabs so an empty Live list is not mistaken
 * for a failed download when the movies are present.
 */

import React, { useEffect, useMemo, useState } from "react";
import { FlatList, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { useT } from "@/i18n";
import { IptvFrame, LoadBanner, sectionTitle, useIptvStyles } from "@/components/iptv/bits";
import { IptvPlayer } from "@/components/player/IptvPlayer";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { useResponsive } from "@/hooks/useResponsive";
import { currentAndNext } from "@/lib/iptv/guide.mjs";
import { loadGuide, xtreamCatchupPlayUrl, xtreamPlayUrl, type IptvEntry } from "@/lib/iptv/load";
import { cancelRefresh, refreshPlaylist } from "@/lib/iptv/refresh";
import { readSecret } from "@/lib/secrets";
import { useTheme } from "@/theme";
import { useIptvSession } from "@/store/iptv-session";
import {
  iptvPasswordKey,
  resumeKey,
  sourceAgent,
  sourcePlayer,
  useIptv,
  type IptvSource,
} from "@/store/iptv-store";

type BrowseSection = "live" | "movie" | "series" | "favorites" | "recent";

const NO_ITEMS: IptvEntry[] = [];

function asSection(value: string | string[] | undefined): BrowseSection {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "movie" || raw === "series" || raw === "favorites" || raw === "recent") return raw;
  return "live";
}

export default function BrowsePlaylist() {
  const t = useT();
  const styles = useIptvStyles();
  const { colors } = useTheme();
  const { isMobile, gridColumns } = useResponsive();
  const params = useLocalSearchParams<{ section?: string }>();
  const section = asSection(params.section);
  const sources = useIptv((state) => state.sources);
  const activeId = useIptv((state) => state.activeSourceId);
  const source = sources.find((item) => item.id === activeId) ?? null;
  const favorites = useIptv((state) => state.favorites);
  const toggleFavorite = useIptv((state) => state.toggleFavorite);
  const recent = useIptv((state) => state.recent);
  const remember = useIptv((state) => state.remember);
  const resume = useIptv((state) => state.resume);
  const setResume = useIptv((state) => state.setResume);
  const preset = useIptv((state) => state.userAgentPreset);
  const customAgent = useIptv((state) => state.userAgent);
  const globalPlayer = useIptv((state) => state.player);
  const session = useIptvSession();
  const [group, setGroup] = useState("");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<{ url: string; id: string; kind: string } | null>(null);
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [pinError, setPinError] = useState("");
  const [playbackNote, setPlaybackNote] = useState("");

  useEffect(() => {
    const next = useIptv.getState().sources.find((item) => item.id === activeId);
    if (!next) return;
    const current = useIptvSession.getState();
    if (current.sourceId === next.id && current.phase !== "idle") return;
    void refreshPlaylist(next);
  }, [activeId]);

  useEffect(() => {
    if (!source?.xmltvUrl || section !== "live") return;
    const current = useIptvSession.getState();
    if (current.guideUrl === source.xmltvUrl && current.programmes.length) return;
    const agent = sourceAgent(source, preset, customAgent);
    void loadGuide(source.xmltvUrl, agent)
      .then((parsed) => useIptvSession.getState().setGuide(source.xmltvUrl, parsed.programmes))
      .catch(() => undefined);
  }, [customAgent, preset, section, source]);

  const counts = session.sourceId === source?.id ? session.counts : source?.counts ?? { live: 0, movie: 0, series: 0 };
  const items = session.sourceId === source?.id ? session.items : NO_ITEMS;

  const groups = useMemo(() => {
    const names = new Set<string>();
    for (const item of items) {
      if (section === "favorites" || section === "recent") continue;
      if (item.kind !== section) continue;
      const name = item.groupName || item.group;
      if (name) names.add(name);
    }
    return [...names].sort((left, right) => left.localeCompare(right));
  }, [items, section]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (section === "recent") {
      return recent
        .filter((row) => row.sourceId === source?.id)
        .map((row) => items.find((item) => item.kind === row.kind && item.id === row.itemId) || rowToEntry(row))
        .filter((item) => !needle || item.name.toLowerCase().includes(needle));
    }
    return items.filter((item) => {
      const favId = `${source?.id ?? ""}:${item.kind}:${item.id}`;
      if (section === "favorites") {
        if (!favorites.includes(favId)) return false;
      } else if (item.kind !== section) return false;
      const name = item.groupName || item.group;
      if (group && name !== group) return false;
      if (needle && !item.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [favorites, group, items, query, recent, section, source?.id]);

  const locked = Boolean(group && source?.lockedGroups.includes(group) && !unlocked.includes(group));

  const open = async (item: IptvEntry) => {
    if (!source) return;
    if (item.kind !== "live") {
      router.push({ pathname: "/(tabs)/iptv/detail", params: { id: item.id, kind: item.kind } });
      return;
    }
    try {
      const url = await playableUrl(source, item);
      remember({ sourceId: source.id, itemId: item.id, kind: item.kind, name: item.name, logo: item.logo, at: Date.now() });
      setPlaybackNote("");
      setPlaying({ url, id: item.id, kind: item.kind });
    } catch (cause) {
      useIptvSession.getState().fail(source.id, cause instanceof Error ? cause.message : t("Could not reach the server"));
    }
  };

  const catchUp = async (item: IptvEntry) => {
    if (!source || source.kind !== "xtream" || item.archiveHours <= 0) return;
    const password = await readSecret(iptvPasswordKey(source.id));
    const minutes = Math.min(60, item.archiveHours * 60);
    setPlaying({
      url: xtreamCatchupPlayUrl(source.server, source.username, password, item, minutes),
      id: item.id,
      kind: "live",
    });
  };

  const unlock = async () => {
    if (!source || !group) return;
    const saved = await readSecret(`cinelog.iptv.pin.${source.id}`);
    if (saved && saved === pin.trim()) {
      setUnlocked((value) => [...value, group]);
      setPin("");
      setPinError("");
    } else {
      setPinError(t("PIN"));
    }
  };

  if (!source) {
    return (
      <IptvFrame title="IPTV">
        <Button label={t("Playlists")} onPress={() => router.replace("/(tabs)/iptv")} />
      </IptvFrame>
    );
  }

  const agent = sourceAgent(source, preset, customAgent);
  const engine = sourcePlayer(source, globalPlayer);
  const columns = section === "live" ? 1 : Math.max(2, gridColumns);
  const emptyCopy = emptyText(section, counts, items.length, session.phase, t);

  return (
    <IptvFrame title={sectionTitle(section, counts, t)} scroll={false}>
      <View style={styles.row}>
        <Text style={styles.title}>{sectionTitle(section, counts, t)}</Text>
        <Text style={styles.meta}>
          {source.updatedAt ? t("Updated {{time}}", { time: new Date(source.updatedAt).toLocaleString() }) : t("Not loaded yet")}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {(["live", "movie", "series", "favorites"] as const).map((id) => (
          <Pressable key={id} style={[styles.chip, section === id ? styles.chipOn : null]} onPress={() => {
            setGroup("");
            setPlaying(null);
            router.setParams({ section: id });
          }}>
            <Text style={styles.chipText}>
              {id === "favorites" ? t("Favorites") : sectionTitle(id, counts, t)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <LoadBanner onCancel={cancelRefresh} onRetry={() => void refreshPlaylist(source)} />
      {section === "favorites" || section === "recent" || !isMobile ? null : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          <Pressable style={[styles.chip, !group ? styles.chipOn : null]} onPress={() => setGroup("")}>
            <Text style={styles.chipText}>{t("All")}</Text>
          </Pressable>
          {groups.map((name) => (
            <Pressable key={name} style={[styles.chip, group === name ? styles.chipOn : null]} onPress={() => setGroup(name)}>
              <Text style={styles.chipText} numberOfLines={1}>{name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t("Search")}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      {playing && (section === "live" || !isMobile) ? (
        <IptvPlayer
          key={playing.url}
          url={playing.url}
          userAgent={agent}
          engine={engine}
          startPositionMs={resume[resumeKey(source.id, playing.kind, playing.id)] || 0}
          onError={setPlaybackNote}
          onProgress={(position) => {
            if (position > 15000) setResume(resumeKey(source.id, playing.kind, playing.id), position);
          }}
        />
      ) : null}
      {playbackNote ? <Text style={styles.error}>{t(playbackNote)}</Text> : null}
      {locked ? (
        <View style={styles.card}>
          <Text style={styles.label}>{t("Parental lock")}</Text>
          <TextInput value={pin} onChangeText={setPin} secureTextEntry placeholder={t("PIN")} placeholderTextColor={colors.textMuted} style={styles.input} />
          {pinError ? <Text style={styles.error}>{pinError}</Text> : null}
          <Button label={t("Unlock")} size="sm" onPress={() => void unlock()} />
        </View>
      ) : (
        <View style={{ flex: 1, flexDirection: "row", gap: 8 }}>
          {!isMobile && section !== "favorites" && section !== "recent" ? (
            <ScrollView style={{ width: 200 }} contentContainerStyle={{ gap: 6 }}>
              <Pressable style={[styles.chip, !group ? styles.chipOn : null]} onPress={() => setGroup("")}>
                <Text style={styles.chipText}>{t("All")}</Text>
              </Pressable>
              {groups.map((name) => (
                <Pressable key={name} style={[styles.chip, group === name ? styles.chipOn : null]} onPress={() => setGroup(name)}>
                  <Text style={styles.chipText} numberOfLines={2}>{name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <FlatList
            key={`${section}-${columns}`}
            data={visible}
            style={{ flex: 1 }}
            numColumns={columns}
            keyExtractor={(item) => `${item.kind}-${item.id}`}
            columnWrapperStyle={columns > 1 ? { gap: 8 } : undefined}
            ListEmptyComponent={<Text style={styles.copy}>{emptyCopy}</Text>}
            renderItem={({ item }) => {
              const favId = `${source.id}:${item.kind}:${item.id}`;
              const guide = item.tvgId ? currentAndNext(session.programmes, item.tvgId, Date.now(), source.epgOffsetHours) : null;
              return (
                <Pressable style={[styles.card, columns > 1 ? { flex: 1, marginBottom: 8 } : null]} onPress={() => void open(item)}>
                  <View style={styles.row}>
                    {item.logo ? (
                      <Image source={{ uri: item.logo, headers: { "User-Agent": agent } }} style={styles.logo} contentFit="contain" />
                    ) : (
                      <View style={[styles.logo, { alignItems: "center", justifyContent: "center" }]}>
                        <Text style={styles.tileTitle}>{item.name.slice(0, 1).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.channel}>
                      <Text style={styles.channelTitle} numberOfLines={2}>{item.name}</Text>
                      {guide?.current?.title ? <Text style={styles.meta} numberOfLines={1}>{t("Current")}: {guide.current.title}</Text> : null}
                      {guide?.next?.title ? <Text style={styles.meta} numberOfLines={1}>{t("Next")}: {guide.next.title}</Text> : null}
                    </View>
                    <Pressable onPress={() => toggleFavorite(favId)} accessibilityLabel={t("Favorites")}>
                      <Ionicons name={favorites.includes(favId) ? "heart" : "heart-outline"} size={18} color={colors.accent} />
                    </Pressable>
                  </View>
                  {item.archiveHours > 0 ? (
                    <Pressable onPress={() => void catchUp(item)}>
                      <Text style={styles.meta}>{t("Catch-up")}</Text>
                    </Pressable>
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      )}
    </IptvFrame>
  );
}

function rowToEntry(row: { itemId: string; kind: string; name: string; logo: string }): IptvEntry {
  const kind = row.kind === "movie" || row.kind === "series" ? row.kind : "live";
  return {
    id: row.itemId,
    name: row.name,
    group: "",
    groupName: "",
    tvgId: "",
    logo: row.logo,
    url: "",
    kind,
    archiveHours: 0,
    streamId: Number(row.itemId) || 0,
    extension: "",
  };
}

async function playableUrl(source: IptvSource, item: IptvEntry) {
  if (item.url) return item.url;
  const password = await readSecret(iptvPasswordKey(source.id));
  if (!password) throw new Error("The saved Xtream password is missing. Add the playlist again.");
  return xtreamPlayUrl(source.server, source.username, password, item, source.streamFormat);
}

function emptyText(
  section: string,
  counts: { live: number; movie: number; series: number },
  total: number,
  phase: string,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  if (phase === "download" || phase === "parsing" || phase === "idle") return t("Loading");
  if (!total && phase === "ready") return "";
  if (section === "live" && counts.live === 0 && (counts.movie > 0 || counts.series > 0)) {
    return t("No live channels in this playlist. Movies {{movies}}, Series {{series}}.", {
      movies: counts.movie,
      series: counts.series,
    });
  }
  if (section === "favorites") return t("No favorites yet.");
  if (section === "recent") return t("No recent titles.");
  return t("Nothing in this category");
}
