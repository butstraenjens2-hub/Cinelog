/**
 * IPTV tab. Empty until the viewer adds their own M3U playlist or Xtream login.
 * CineLog does not ship a playlist, category list, or channel source.
 */

import React, { useMemo, useState } from "react";
import { FlatList, ScrollView, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { SeoHead } from "@/components/SeoHead";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { BroadcastPlayer } from "@/components/player/BroadcastPlayer";
import { Button } from "@/components/ui/Button";
import { GenrePill } from "@/components/ui/GenrePill";
import { Screen } from "@/components/ui/Screen";
import { FONTS, RADIUS, SPACING } from "@/constants/theme";
import { makeStyles, useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import {
  entriesFromM3u,
  loadGuide,
  loadM3uUrl,
  loadXtreamCatalogue,
  loadXtreamEpisodes,
  xtreamCatchupPlayUrl,
  xtreamPlayUrl,
  type IptvEntry,
  type IptvEpisode,
} from "@/lib/iptv/load";
import { readSecret, writeSecret } from "@/lib/secrets";
import { iptvPasswordKey, useIptv, type IptvSource } from "@/store/iptv-store";
import { useAuth } from "@/store/auth-store";

type Section = "live" | "movie" | "series";

export default function IptvScreen() {
  const t = useT();
  const styles = useStyles();
  const { colors } = useTheme();
  const { isMobile, gutter } = useResponsive();
  const user = useAuth((state) => state.user);
  const sources = useIptv((state) => state.sources);
  const addSource = useIptv((state) => state.addSource);
  const removeSource = useIptv((state) => state.removeSource);
  const favorites = useIptv((state) => state.favorites);
  const toggleFavorite = useIptv((state) => state.toggleFavorite);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("live");
  const [group, setGroup] = useState("");
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [items, setItems] = useState<IptvEntry[]>([]);
  const [episodes, setEpisodes] = useState<IptvEpisode[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [guide, setGuide] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<"m3u" | "xtream" | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [draftEpg, setDraftEpg] = useState("");
  const [draftServer, setDraftServer] = useState("");
  const [draftUser, setDraftUser] = useState("");
  const [draftPass, setDraftPass] = useState("");

  const source = sources.find((item) => item.id === sourceId) ?? sources[0] ?? null;

  const loadSource = async (next: IptvSource) => {
    setBusy(true);
    setMessage(null);
    setPlaying(null);
    setEpisodes([]);
    setGuide("");
    try {
      if (next.kind === "m3u") {
        const text = next.fileUri
          ? await FileSystem.readAsStringAsync(next.fileUri)
          : null;
        setItems(text ? entriesFromM3u(text) : await loadM3uUrl(next.url));
      } else {
        const password = await readSecret(iptvPasswordKey(next.id));
        if (!password) throw new Error(t("The saved Xtream password is missing. Add the playlist again."));
        setItems(await loadXtreamCatalogue(next.server, next.username, password));
      }
      setSourceId(next.id);
    } catch (cause) {
      setItems([]);
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (item.kind !== section) return false;
      const favId = `${source?.id ?? ""}:${item.kind}:${item.id}`;
      if (favoritesOnly && !favorites.includes(favId)) return false;
      if (group && (item.groupName || item.group) !== group) return false;
      if (needle && !item.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [favorites, favoritesOnly, group, items, query, section, source?.id]);

  const groups = useMemo(() => {
    const names = new Set<string>();
    for (const item of items) {
      if (item.kind !== section) continue;
      const name = item.groupName || item.group;
      if (name) names.add(name);
    }
    return [...names].sort((left, right) => left.localeCompare(right));
  }, [items, section]);

  const saveM3u = async (text: string | null, url: string, fileUri = "") => {
    const id = `m3u-${Date.now()}`;
    let stored = fileUri;
    if (text && !stored) {
      const dir = `${FileSystem.documentDirectory ?? ""}iptv/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      stored = `${dir}${id}.m3u`;
      await FileSystem.writeAsStringAsync(stored, text);
    }
    let host = t("Import M3U file");
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error("unsupported");
        }
        host = parsed.host;
      } catch {
        setMessage(t("Enter a valid http or https URL."));
        return;
      }
    }
    const next: IptvSource = {
      id,
      name: host,
      kind: "m3u",
      url,
      fileUri: stored,
      xmltvUrl: draftEpg.trim(),
      server: "",
      username: "",
    };
    addSource(next);
    setForm(null);
    await loadSource(next);
  };

  const saveXtream = async () => {
    let host = "";
    try {
      const parsed = new URL(draftServer.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("unsupported");
      }
      host = parsed.host;
    } catch {
      setMessage(t("Enter a valid http or https URL."));
      return;
    }
    const id = `xt-${Date.now()}`;
    await writeSecret(iptvPasswordKey(id), draftPass);
    const next: IptvSource = {
      id,
      name: host,
      kind: "xtream",
      url: "",
      fileUri: "",
      xmltvUrl: draftEpg.trim(),
      server: draftServer.trim(),
      username: draftUser.trim(),
    };
    addSource(next);
    setDraftPass("");
    setForm(null);
    await loadSource(next);
  };

  const importFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    const text = await FileSystem.readAsStringAsync(picked.assets[0].uri);
    await saveM3u(text, "", "");
  };

  const play = async (item: IptvEntry, url?: string) => {
    setGuide("");
    if (url) {
      setPlaying(url);
      return;
    }
    if (item.url) {
      setPlaying(item.url);
    } else if (source?.kind === "xtream") {
      const password = await readSecret(iptvPasswordKey(source.id));
      if (item.kind === "series") {
        setEpisodes(await loadXtreamEpisodes(source.server, source.username, password, item.streamId));
        setPlaying(null);
        return;
      }
      setPlaying(xtreamPlayUrl(source.server, source.username, password, item));
    }
    if (section === "live" && source?.xmltvUrl && item.tvgId) {
      try {
        const parsed = await loadGuide(source.xmltvUrl);
        const now = Date.now();
        const current = parsed.programmes.find(
          (programme: { channelId: string; startMs: number; stopMs: number; title: string }) =>
            programme.channelId === item.tvgId && programme.startMs <= now && programme.stopMs > now,
        );
        setGuide(current?.title ?? "");
      } catch {
        setGuide("");
      }
    }
  };

  const catchUp = async (item: IptvEntry, minutes: number) => {
    if (!source || source.kind !== "xtream") return;
    const password = await readSecret(iptvPasswordKey(source.id));
    setPlaying(xtreamCatchupPlayUrl(source.server, source.username, password, item, minutes));
  };

  return (
    <>
      <SeoHead title="IPTV" description="Play a playlist you add yourself." />
      <Screen
        reserveBottomNav
        scroll={false}
        contentStyle={{ flex: 1 }}
        header={
          isMobile ? (
            <MobileHeader
              title="IPTV"
              onOpenProfile={() => router.push("/profile")}
              gutter={gutter}
              displayName={user?.displayName ?? t("Guest")}
              avatarUrl={user?.avatarUrl ?? null}
            />
          ) : null
        }
      >
        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          {isMobile ? null : (
            <Text style={styles.title} accessibilityRole="header">
              IPTV
            </Text>
          )}
          <Text style={styles.copy}>
            {t("CineLog does not include any playlist. Add your own M3U URL, M3U file, or Xtream login.")}
          </Text>
          <View style={styles.row}>
            <Button label={t("Add M3U URL")} size="sm" variant="secondary" onPress={() => setForm("m3u")} />
            <Button label={t("Import M3U file")} size="sm" variant="secondary" onPress={() => void importFile()} />
            <Button label={t("Xtream Codes")} size="sm" variant="secondary" onPress={() => setForm("xtream")} />
          </View>
          {form === "m3u" ? (
            <View style={styles.card}>
              <Text style={styles.label}>{t("M3U URL")}</Text>
              <TextInput
                value={draftUrl}
                onChangeText={setDraftUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://example.com/playlist.m3u8"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <Text style={styles.label}>{t("XMLTV guide URL")}</Text>
              <TextInput
                value={draftEpg}
                onChangeText={setDraftEpg}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://example.com/guide.xml"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <Button
                label={t("Save playlist")}
                size="sm"
                disabled={!draftUrl.trim()}
                onPress={() => void saveM3u(null, draftUrl.trim())}
              />
            </View>
          ) : null}
          {form === "xtream" ? (
            <View style={styles.card}>
              <Text style={styles.label}>{t("Server URL")}</Text>
              <TextInput value={draftServer} onChangeText={setDraftServer} autoCapitalize="none" autoCorrect={false} placeholder="http://example.com:8080" placeholderTextColor={colors.textMuted} style={styles.input} />
              <Text style={styles.label}>{t("Username")}</Text>
              <TextInput value={draftUser} onChangeText={setDraftUser} autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.textMuted} style={styles.input} />
              <Text style={styles.label}>{t("Password")}</Text>
              <TextInput value={draftPass} onChangeText={setDraftPass} secureTextEntry autoCapitalize="none" placeholderTextColor={colors.textMuted} style={styles.input} />
              <Text style={styles.label}>{t("XMLTV guide URL")}</Text>
              <TextInput value={draftEpg} onChangeText={setDraftEpg} autoCapitalize="none" autoCorrect={false} placeholder="https://example.com/guide.xml" placeholderTextColor={colors.textMuted} style={styles.input} />
              <Button
                label={t("Save playlist")}
                size="sm"
                disabled={!draftServer.trim() || !draftUser.trim() || !draftPass.trim()}
                onPress={() => void saveXtream().catch((cause: unknown) => setMessage(cause instanceof Error ? cause.message : t("Could not reach the server")))}
              />
            </View>
          ) : null}
          {sources.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {sources.map((item) => (
                <GenrePill key={item.id} label={item.name} selected={source?.id === item.id} onPress={() => void loadSource(item)} />
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.copy}>{t("No playlist yet")}</Text>
          )}
          {source ? (
            <Button
              label={t("Remove playlist")}
              size="sm"
              variant="secondary"
              onPress={() => {
                void writeSecret(iptvPasswordKey(source.id), "");
                removeSource(source.id);
                setItems([]);
                setPlaying(null);
              }}
            />
          ) : null}
          <View style={styles.row}>
            {(["live", "movie", "series"] as const).map((value) => (
              <GenrePill
                key={value}
                label={value === "live" ? t("Live") : value === "movie" ? t("Movies") : t("Series")}
                selected={section === value && !favoritesOnly}
                onPress={() => {
                  setFavoritesOnly(false);
                  setSection(value);
                  setGroup("");
                  setEpisodes([]);
                }}
              />
            ))}
            <GenrePill label={t("Favorites")} selected={favoritesOnly} onPress={() => setFavoritesOnly((value) => !value)} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            <GenrePill label={t("Categories")} selected={!group} onPress={() => setGroup("")} />
            {groups.map((name) => (
              <GenrePill key={name} label={name} selected={group === name} onPress={() => setGroup(name)} />
            ))}
          </ScrollView>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("Search")}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          {playing ? <BroadcastPlayer key={playing} url={playing} /> : null}
          {guide ? <Text style={styles.copy}>{t("Guide")}: {guide}</Text> : null}
          {busy ? <Text style={styles.copy}>{t("Loading")}</Text> : null}
          {message ? <Text style={styles.error}>{message}</Text> : null}
          <FlatList
            data={episodes.length ? [] : visible}
            keyExtractor={(item) => `${item.kind}-${item.id}`}
            style={{ flex: 1, alignSelf: "stretch" }}
            ListEmptyComponent={
              episodes.length ? null : <Text style={styles.copy}>{items.length ? t("Nothing in this category") : ""}</Text>
            }
            renderItem={({ item }) => {
              const favId = `${source?.id ?? ""}:${item.kind}:${item.id}`;
              return (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  {item.groupName ? <Text style={styles.meta}>{item.groupName}</Text> : null}
                  <View style={styles.row}>
                    <Button label={item.kind === "series" && !item.url ? t("Episodes") : t("Play")} size="sm" onPress={() => void play(item)} />
                    <Button
                      label={t("Favorites")}
                      size="sm"
                      variant={favorites.includes(favId) ? "primary" : "secondary"}
                      onPress={() => toggleFavorite(favId)}
                    />
                    {item.archiveHours > 0 ? (
                      <Button label={t("Catch-up")} size="sm" variant="secondary" onPress={() => void catchUp(item, Math.min(60, item.archiveHours * 60))} />
                    ) : null}
                  </View>
                </View>
              );
            }}
          />
          {episodes.map((episode) => (
            <View key={episode.id} style={styles.card}>
              <Text style={styles.cardTitle}>{episode.name}</Text>
              <Button label={t("Play")} size="sm" onPress={() => void play({ id: episode.id, name: episode.name, group: "", groupName: "", tvgId: "", logo: "", url: episode.url, kind: "series", archiveHours: 0, streamId: 0, extension: "" }, episode.url)} />
            </View>
          ))}
        </View>
      </Screen>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  body: { flex: 1, gap: SPACING.sm, paddingTop: SPACING.md, paddingBottom: 24 },
  title: { fontFamily: FONTS.extrabold, fontSize: 30, color: c.textPrimary },
  copy: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: c.textSecondary },
  label: { fontFamily: FONTS.semibold, fontSize: 13, color: c.textPrimary },
  error: { fontFamily: FONTS.medium, fontSize: 13, color: c.error },
  row: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  card: {
    alignSelf: "stretch",
    gap: 6,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardTitle: { fontFamily: FONTS.semibold, fontSize: 15, color: c.textPrimary },
  meta: { fontFamily: FONTS.regular, fontSize: 12, color: c.textMuted },
  input: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: FONTS.regular,
    fontSize: 15,
  },
}));
