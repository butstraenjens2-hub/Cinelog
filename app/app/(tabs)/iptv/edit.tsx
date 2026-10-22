/**
 * Add or edit one playlist. Validation shows Xtream account info
 * or the M3U section counts before the playlist is kept.
 */

import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams } from "expo-router";

import { useT } from "@/i18n";
import { IptvFrame, useIptvStyles } from "@/components/iptv/bits";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { loadM3uText, loadM3uUrl, loadXtreamAccount } from "@/lib/iptv/load";
import { readSecret, writeSecret } from "@/lib/secrets";
import { iptvPasswordKey, normalizeSource, useIptv, type IptvAccount, type IptvSource } from "@/store/iptv-store";

function httpUrl(value: string) {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("unsupported");
  return parsed;
}

export default function EditPlaylist() {
  const t = useT();
  const styles = useIptvStyles();
  const params = useLocalSearchParams<{ id?: string }>();
  const existing = useIptv((state) => state.sources.find((item) => item.id === params.id) ?? null);
  const addSource = useIptv((state) => state.addSource);
  const updateSource = useIptv((state) => state.updateSource);
  const preset = useIptv((state) => state.userAgentPreset);
  const storedAgent = useIptv((state) => state.userAgent);
  const [kind, setKind] = useState<"m3u" | "xtream" | null>(existing?.kind ?? null);
  const [name, setName] = useState(existing?.name ?? "");
  const [url, setUrl] = useState(existing?.url ?? "");
  const [fileUri, setFileUri] = useState(existing?.fileUri ?? "");
  const [epg, setEpg] = useState(existing?.xmltvUrl ?? "");
  const [server, setServer] = useState(existing?.server ?? "");
  const [username, setUsername] = useState(existing?.username ?? "");
  const [password, setPassword] = useState("");
  const [account, setAccount] = useState<IptvAccount | null>(existing?.account ?? null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const validate = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (kind === "xtream") {
        const pass = password || (existing ? await readSecret(iptvPasswordKey(existing.id)) : "");
        if (!pass) throw new Error(t("The saved Xtream password is missing. Add the playlist again."));
        httpUrl(server);
        const next = await loadXtreamAccount(server.trim(), username.trim(), pass, existing?.userAgent || storedAgent);
        setAccount(next);
        setMessage(`${t("Account status")}: ${next.status || "—"}\n${t("Expiry")}: ${next.expiry ? new Date(next.expiry).toLocaleDateString() : "—"}\n${t("Max connections")}: ${next.maxConnections || "—"}\n${t("Active connections")}: ${next.activeConnections || "—"}`);
      } else if (fileUri && !url.trim()) {
        const text = await FileSystem.readAsStringAsync(fileUri);
        const loaded = loadM3uText(text);
        setMessage(loaded.diagnosis
          ? `${t("The playlist has no entries.")} ${t(loaded.diagnosis.reason)}`
          : `${t("Live {{count}}", { count: loaded.counts.live })} · ${t("Movies {{count}}", { count: loaded.counts.movie })} · ${t("Series {{count}}", { count: loaded.counts.series })}`);
      } else {
        httpUrl(url);
        const loaded = await loadM3uUrl(url.trim(), existing?.userAgent || storedAgent);
        setMessage(loaded.diagnosis
          ? [t("The playlist has no entries."), loaded.diagnosis.status ? t("HTTP {{status}}", { status: loaded.diagnosis.status }) : "", loaded.diagnosis.contentType, t(loaded.diagnosis.reason), loaded.diagnosis.snippet].filter(Boolean).join(" ")
          : `${t("Live {{count}}", { count: loaded.counts.live })} · ${t("Movies {{count}}", { count: loaded.counts.movie })} · ${t("Series {{count}}", { count: loaded.counts.series })}`);
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      setMessage(t("Add a name for this playlist."));
      return;
    }
    setBusy(true);
    try {
      if (kind === "xtream") {
        httpUrl(server);
        const id = existing?.id ?? `xt-${Date.now()}`;
        const pass = password || (existing ? await readSecret(iptvPasswordKey(existing.id)) : "");
        if (!pass) throw new Error(t("The saved Xtream password is missing. Add the playlist again."));
        let nextAccount = account;
        try {
          nextAccount = await loadXtreamAccount(server.trim(), username.trim(), pass, storedAgent);
        } catch (cause) {
          setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
          return;
        }
        if (password) await writeSecret(iptvPasswordKey(id), password);
        const source = normalizeSource({
          ...(existing ?? {}),
          id,
          name: name.trim(),
          kind: "xtream",
          url: "",
          fileUri: "",
          xmltvUrl: epg.trim(),
          server: server.trim().replace(/\/+$/, ""),
          username: username.trim(),
          account: nextAccount,
          userAgentPreset: existing?.userAgentPreset || preset,
          userAgent: existing?.userAgent || (preset === "custom" ? storedAgent : ""),
        });
        if (existing) updateSource(id, source);
        else addSource(source);
        setPassword("");
        router.replace("/(tabs)/iptv/home");
        return;
      }
      let host = name.trim();
      if (url.trim()) {
        host = name.trim() || httpUrl(url).host;
      }
      const id = existing?.id ?? `m3u-${Date.now()}`;
      let stored = fileUri;
      if (!url.trim() && !stored) {
        setMessage(t("Add a playlist URL or file first."));
        return;
      }
      const source: IptvSource = normalizeSource({
        ...(existing ?? {}),
        id,
        name: host,
        kind: "m3u",
        url: url.trim(),
        fileUri: stored,
        xmltvUrl: epg.trim(),
        server: "",
        username: "",
        userAgentPreset: existing?.userAgentPreset || preset,
        userAgent: existing?.userAgent || (preset === "custom" ? storedAgent : ""),
      });
      if (existing) updateSource(id, source);
      else addSource(source);
      router.replace("/(tabs)/iptv/home");
    } catch {
      setMessage(t("Enter a valid http or https URL."));
    } finally {
      setBusy(false);
    }
  };

  const importFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return;
    const id = existing?.id ?? `m3u-${Date.now()}`;
    const dir = `${FileSystem.documentDirectory ?? ""}iptv/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const target = `${dir}${id}.m3u`;
    await FileSystem.copyAsync({ from: picked.assets[0].uri, to: target });
    setFileUri(target);
    setKind("m3u");
    if (!name.trim()) setName(picked.assets[0].name?.replace(/\.m3u8?$/i, "") || t("M3U playlist"));
  };

  return (
    <IptvFrame title={existing ? t("Edit playlist") : t("Add playlist")}>
      <Text style={styles.title}>{existing ? t("Edit playlist") : t("Add playlist")}</Text>
      {!existing ? (
        <View style={styles.grid}>
          <Pressable style={[styles.tile, kind === "xtream" ? styles.chipOn : null]} onPress={() => setKind("xtream")}>
            <Text style={styles.tileTitle}>{t("Login with Xtream Codes API")}</Text>
          </Pressable>
          <Pressable style={[styles.tile, kind === "m3u" ? styles.chipOn : null]} onPress={() => setKind("m3u")}>
            <Text style={styles.tileTitle}>{t("Load your playlist or file")}</Text>
          </Pressable>
        </View>
      ) : null}
      {kind ? (
        <View style={styles.card}>
          <Text style={styles.label}>{t("Playlist name")}</Text>
          <TextInput value={name} onChangeText={setName} placeholderTextColor="#888" style={styles.input} />
          {kind === "xtream" ? (
            <>
              <Text style={styles.label}>{t("Server URL")}</Text>
              <TextInput value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} placeholder="http://example.com:8080" placeholderTextColor="#888" style={styles.input} />
              <Text style={styles.label}>{t("Username")}</Text>
              <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholderTextColor="#888" style={styles.input} />
              <Text style={styles.label}>{t("Password")}</Text>
              <TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder={existing ? t("Leave blank to keep the saved password.") : ""} placeholderTextColor="#888" style={styles.input} />
            </>
          ) : (
            <>
              <Text style={styles.label}>{t("M3U URL")}</Text>
              <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} placeholder="https://example.com/playlist.m3u" placeholderTextColor="#888" style={styles.input} />
              <Button label={t("Import M3U file")} size="sm" variant="secondary" onPress={() => void importFile()} />
              {fileUri ? <Text style={styles.meta}>{t("M3U playlist")}</Text> : null}
            </>
          )}
          <Text style={styles.label}>{t("Optional guide URL")}</Text>
          <TextInput value={epg} onChangeText={setEpg} autoCapitalize="none" autoCorrect={false} placeholder="https://example.com/guide.xml" placeholderTextColor="#888" style={styles.input} />
          <View style={styles.row}>
            <Button label={t("Validate")} size="sm" variant="secondary" loading={busy} onPress={() => void validate()} />
            <Button label={t("Save playlist")} size="sm" loading={busy} onPress={() => void save()} />
          </View>
          {message ? <Text style={styles.copy} selectable>{message}</Text> : null}
        </View>
      ) : null}
      <Button label={t("Playlists")} variant="ghost" onPress={() => router.back()} />
    </IptvFrame>
  );
}
