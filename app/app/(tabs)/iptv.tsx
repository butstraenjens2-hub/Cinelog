/**
 * IPTV tab. Empty until the viewer adds their own M3U playlist or Xtream login.
 * CineLog does not ship a playlist, category list, or channel source.
 */

import React, { useMemo, useState } from "react";
import { FlatList, Modal, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { SeoHead } from "@/components/SeoHead";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { BroadcastPlayer } from "@/components/player/BroadcastPlayer";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Screen } from "@/components/ui/Screen";
import { FONTS, RADIUS, SPACING } from "@/constants/theme";
import { makeStyles, useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import { diagnoseM3u, diagnoseXtream } from "@/lib/iptv/diagnose.mjs";
import { IPTV_PRESETS, resolveUserAgent } from "@/lib/iptv/http.mjs";
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

type Section = "live" | "movie" | "series" | "favorites";

export default function IptvScreen() {
  const t = useT();
  const styles = useStyles();
  const { colors } = useTheme();
  const { isMobile, gutter, width } = useResponsive();
  const user = useAuth((state) => state.user);
  const sources = useIptv((state) => state.sources);
  const addSource = useIptv((state) => state.addSource);
  const removeSource = useIptv((state) => state.removeSource);
  const favorites = useIptv((state) => state.favorites);
  const toggleFavorite = useIptv((state) => state.toggleFavorite);
  const storedAgent = useIptv((state) => state.userAgent);
  const setUserAgent = useIptv((state) => state.setUserAgent);
  const preset = useIptv((state) => state.userAgentPreset);
  const setPreset = useIptv((state) => state.setUserAgentPreset);
  const userAgent = resolveUserAgent(preset, storedAgent);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [section, setSection] = useState<Section>("live");
  const [group, setGroup] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<IptvEntry[]>([]);
  const [episodes, setEpisodes] = useState<IptvEpisode[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [guide, setGuide] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [diag, setDiag] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<"m3u" | "xtream" | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [draftEpg, setDraftEpg] = useState("");
  const [draftServer, setDraftServer] = useState("");
  const [draftUser, setDraftUser] = useState("");
  const [draftPass, setDraftPass] = useState("");

  const source = sources.find((item) => item.id === sourceId) ?? sources[0] ?? null;
  const columns = width >= 900 ? 4 : width >= 600 ? 3 : 2;

  const loadSource = async (next: IptvSource) => {
    setBusy(true);
    setMessage(null);
    setPlaying(null);
    setEpisodes([]);
    setGuide("");
    try {
      if (next.kind === "m3u") {
        const text = next.fileUri ? await FileSystem.readAsStringAsync(next.fileUri) : null;
        setItems(text ? entriesFromM3u(text) : await loadM3uUrl(next.url, userAgent));
      } else {
        const password = await readSecret(iptvPasswordKey(next.id));
        if (!password) throw new Error(t("The saved Xtream password is missing. Add the playlist again."));
        const catalogue = await loadXtreamCatalogue(next.server, next.username, password, userAgent);
        setItems(catalogue.items);
        if (catalogue.warnings.length) setMessage(catalogue.warnings.join("\n"));
      }
      setSourceId(next.id);
      setMenuOpen(false);
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
      const favId = `${source?.id ?? ""}:${item.kind}:${item.id}`;
      if (section === "favorites") {
        if (!favorites.includes(favId)) return false;
      } else if (item.kind !== section) {
        return false;
      }
      if (group && section !== "favorites" && (item.groupName || item.group) !== group) return false;
      if (needle && !item.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [favorites, group, items, query, section, source?.id]);

  const groups = useMemo(() => {
    const names = new Set<string>();
    for (const item of items) {
      if (section !== "favorites" && item.kind !== section) continue;
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
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("unsupported");
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
    setManageOpen(false);
    await loadSource(next);
  };

  const saveXtream = async () => {
    let host = "";
    try {
      const parsed = new URL(draftServer.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("unsupported");
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
      server: draftServer.trim().replace(/\/+$/, ""),
      username: draftUser.trim(),
    };
    addSource(next);
    setDraftPass("");
    setForm(null);
    setManageOpen(false);
    await loadSource(next);
  };

  const importFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    const text = await FileSystem.readAsStringAsync(picked.assets[0].uri);
    await saveM3u(text, "", "");
  };

  const testConnection = async () => {
    setBusy(true);
    setDiag("");
    try {
      if (form === "m3u" && draftUrl.trim()) {
        setDiag((await diagnoseM3u({ url: draftUrl.trim(), userAgent })).join("\n"));
      } else if (form === "xtream" && draftServer.trim() && draftUser.trim() && draftPass) {
        setDiag((await diagnoseXtream({
          server: draftServer.trim(),
          username: draftUser.trim(),
          password: draftPass,
          userAgent,
        })).join("\n"));
      } else if (source?.kind === "m3u" && source.url) {
        setDiag((await diagnoseM3u({ url: source.url, userAgent })).join("\n"));
      } else if (source?.kind === "xtream") {
        const password = await readSecret(iptvPasswordKey(source.id));
        if (!password) throw new Error(t("The saved Xtream password is missing. Add the playlist again."));
        setDiag((await diagnoseXtream({
          server: source.server,
          username: source.username,
          password,
          userAgent,
        })).join("\n"));
      } else {
        setDiag(t("Add a playlist URL or Xtream login first."));
      }
    } catch (cause) {
      setDiag(cause instanceof Error ? cause.message : t("Could not reach the server"));
    } finally {
      setBusy(false);
    }
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
        try {
          setEpisodes(await loadXtreamEpisodes(source.server, source.username, password, item.streamId, userAgent));
        } catch (cause) {
          setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
        }
        setPlaying(null);
        return;
      }
      setPlaying(xtreamPlayUrl(source.server, source.username, password, item));
    }
    if (section === "live" && source?.xmltvUrl && item.tvgId) {
      try {
        const parsed = await loadGuide(source.xmltvUrl, userAgent);
        const now = Date.now();
        const current = parsed.programmes.find(
          (programme: { channelId: string; startMs: number; stopMs: number; title: string }) =>
            programme.channelId === item.tvgId && programme.startMs <= now && programme.stopMs > now,
        );
        setGuide(current?.title ?? "");
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
      }
    }
  };

  const catchUp = async (item: IptvEntry) => {
    if (!source || source.kind !== "xtream" || item.archiveHours <= 0) return;
    const password = await readSecret(iptvPasswordKey(source.id));
    const minutes = Math.min(60, item.archiveHours * 60);
    setPlaying(xtreamCatchupPlayUrl(source.server, source.username, password, item, minutes));
  };

  const segments: { id: Section; label: string }[] = [
    { id: "live", label: t("Live") },
    { id: "movie", label: t("Movies") },
    { id: "series", label: t("Series") },
    { id: "favorites", label: t("Favorites") },
  ];

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
          <Pressable style={styles.headerCard} onPress={() => setMenuOpen((value) => !value)} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>{t("Playlist")}</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {source?.name ?? t("No playlist yet")}
              </Text>
            </View>
            <Ionicons name={menuOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
          </Pressable>
          {menuOpen ? (
            <View style={styles.menu}>
              {sources.length ? sources.map((item) => (
                <Pressable key={item.id} style={styles.menuRow} onPress={() => void loadSource(item)}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.meta}>{item.kind === "xtream" ? "Xtream" : "M3U"}</Text>
                </Pressable>
              )) : <Text style={styles.copy}>{t("CineLog does not include any playlist. Add your own M3U URL, M3U file, or Xtream login.")}</Text>}
            </View>
          ) : null}
          <Button label={t("Add / manage playlists")} size="sm" variant="secondary" onPress={() => setManageOpen(true)} />
          <View style={styles.segment}>
            {segments.map((item) => {
              const selected = section === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.segmentItem, selected ? styles.segmentOn : null]}
                  onPress={() => {
                    setSection(item.id);
                    setGroup("");
                    setEpisodes([]);
                  }}
                >
                  <Text style={[styles.segmentText, selected ? styles.segmentTextOn : null]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {section === "favorites" ? null : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
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
          {playing ? <BroadcastPlayer key={playing} url={playing} headers={{ "User-Agent": userAgent }} /> : null}
          {guide ? <Text style={styles.copy}>{t("Guide")}: {guide}</Text> : null}
          {busy ? <Text style={styles.copy}>{t("Loading")}</Text> : null}
          {message ? <Text style={styles.error}>{message}</Text> : null}
          {episodes.length ? (
            <Pressable onPress={() => setEpisodes([])} style={styles.chip}>
              <Text style={styles.chipText}>{t("Series")}</Text>
            </Pressable>
          ) : null}
          <FlatList
            key={episodes.length ? "episodes" : `grid-${columns}`}
            data={episodes.length ? [] : visible}
            keyExtractor={(item) => `${item.kind}-${item.id}`}
            numColumns={episodes.length ? 1 : columns}
            style={{ flex: 1, alignSelf: "stretch" }}
            columnWrapperStyle={episodes.length ? undefined : styles.gridRow}
            ListEmptyComponent={
              episodes.length ? null : (
                <Text style={styles.copy}>{items.length ? t("Nothing in this category") : ""}</Text>
              )
            }
            renderItem={({ item }) => {
              const favId = `${source?.id ?? ""}:${item.kind}:${item.id}`;
              return (
                <Pressable style={styles.tile} onPress={() => void play(item)}>
                  {item.logo ? (
                    <Image
                      source={{ uri: item.logo, headers: { "User-Agent": userAgent } }}
                      style={styles.logo}
                      contentFit="contain"
                    />
                  ) : (
                    <View style={[styles.logo, styles.logoFallback]}>
                      <Text style={styles.logoLetter}>{item.name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={styles.tileTitle} numberOfLines={2}>{item.name}</Text>
                  <View style={styles.tileActions}>
                    <Pressable onPress={() => toggleFavorite(favId)} accessibilityLabel={t("Favorites")}>
                      <Ionicons name={favorites.includes(favId) ? "heart" : "heart-outline"} size={16} color={colors.accent} />
                    </Pressable>
                    {item.archiveHours > 0 ? (
                      <Pressable onPress={() => void catchUp(item)}>
                        <Text style={styles.meta}>{t("Catch-up")}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
          {episodes.map((episode) => (
            <Pressable key={episode.id} style={styles.menuRow} onPress={() => void play({
              id: episode.id,
              name: episode.name,
              group: "",
              groupName: "",
              tvgId: "",
              logo: "",
              url: episode.url,
              kind: "series",
              archiveHours: 0,
              streamId: 0,
              extension: "",
            }, episode.url)}>
              <Text style={styles.cardTitle}>{episode.name}</Text>
              <Text style={styles.meta}>{t("Play")}</Text>
            </Pressable>
          ))}
        </View>
        <Modal visible={manageOpen} animationType="slide" transparent onRequestClose={() => setManageOpen(false)}>
          <View style={styles.sheetBackdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHead}>
                <Text style={styles.headerTitle}>{t("Add / manage playlists")}</Text>
                <Pressable onPress={() => setManageOpen(false)} accessibilityLabel={t("Close")}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ gap: SPACING.sm, paddingBottom: 24 }}>
                <Text style={styles.copy}>{t("CineLog does not include any playlist. Add your own M3U URL, M3U file, or Xtream login.")}</Text>
                <Text style={styles.label}>{t("User agent")}</Text>
                <View style={styles.chips}>
                  {IPTV_PRESETS.map((item) => (
                    <Pressable
                      key={item.id}
                      style={[styles.chip, preset === item.id ? styles.chipOn : null]}
                      onPress={() => setPreset(item.id)}
                    >
                      <Text style={styles.chipText}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {preset === "custom" ? (
                  <TextInput
                    value={storedAgent}
                    onChangeText={setUserAgent}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="IPTVSmartersPlayer"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                  />
                ) : (
                  <Text style={styles.meta}>{userAgent}</Text>
                )}
                <View style={styles.chips}>
                  <Button label={t("Add M3U URL")} size="sm" variant="secondary" onPress={() => setForm("m3u")} />
                  <Button label={t("Import M3U file")} size="sm" variant="secondary" onPress={() => void importFile()} />
                  <Button label={t("Xtream Codes")} size="sm" variant="secondary" onPress={() => setForm("xtream")} />
                </View>
                {form === "m3u" ? (
                  <View style={styles.card}>
                    <Text style={styles.label}>{t("M3U URL")}</Text>
                    <TextInput value={draftUrl} onChangeText={setDraftUrl} autoCapitalize="none" autoCorrect={false} placeholder="https://example.com/playlist.m3u8" placeholderTextColor={colors.textMuted} style={styles.input} />
                    <Text style={styles.label}>{t("XMLTV guide URL")}</Text>
                    <TextInput value={draftEpg} onChangeText={setDraftEpg} autoCapitalize="none" autoCorrect={false} placeholder="https://example.com/guide.xml" placeholderTextColor={colors.textMuted} style={styles.input} />
                    <Button label={t("Save playlist")} size="sm" disabled={!draftUrl.trim()} onPress={() => void saveM3u(null, draftUrl.trim())} />
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
                <Button label={t("Test connection")} size="sm" variant="secondary" onPress={() => void testConnection()} />
                {diag ? (
                  <Text style={styles.diag} selectable>
                    {diag}
                  </Text>
                ) : null}
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
                      setManageOpen(false);
                    }}
                  />
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </Screen>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  body: { flex: 1, gap: SPACING.sm, paddingTop: SPACING.md, paddingBottom: 12 },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  kicker: { fontFamily: FONTS.medium, fontSize: 11, color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 18, color: c.textPrimary },
  menu: { borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: "hidden" },
  menuRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  copy: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, color: c.textSecondary },
  label: { fontFamily: FONTS.semibold, fontSize: 13, color: c.textPrimary },
  error: { fontFamily: FONTS.medium, fontSize: 13, lineHeight: 18, color: c.error },
  diag: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, color: c.textSecondary },
  segment: { flexDirection: "row", borderRadius: RADIUS.pill, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, padding: 3 },
  segmentItem: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: RADIUS.pill },
  segmentOn: { backgroundColor: c.accent },
  segmentText: { fontFamily: FONTS.semibold, fontSize: 12, color: c.textSecondary },
  segmentTextOn: { color: "#FFFFFF" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, alignItems: "center" },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  chipOn: { borderColor: c.accent, backgroundColor: c.surfaceHover },
  chipText: { fontFamily: FONTS.medium, fontSize: 12, color: c.textPrimary, maxWidth: 160 },
  card: { alignSelf: "stretch", gap: 6, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  cardTitle: { fontFamily: FONTS.semibold, fontSize: 15, color: c.textPrimary, flexShrink: 1 },
  meta: { fontFamily: FONTS.regular, fontSize: 12, color: c.textMuted },
  input: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.background,
    color: c.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: FONTS.regular,
    fontSize: 15,
  },
  gridRow: { gap: SPACING.sm },
  tile: { flex: 1, minWidth: 0, marginBottom: SPACING.sm, padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 6 },
  logo: { width: "100%", aspectRatio: 16 / 10, borderRadius: RADIUS.sm, backgroundColor: c.background },
  logoFallback: { alignItems: "center", justifyContent: "center" },
  logoLetter: { fontFamily: FONTS.bold, fontSize: 22, color: c.textSecondary },
  tileTitle: { fontFamily: FONTS.semibold, fontSize: 13, color: c.textPrimary },
  tileActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { maxHeight: "88%", backgroundColor: c.background, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.sm },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.md },
}));
