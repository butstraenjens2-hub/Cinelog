/**
 * Settings stored on one playlist: player, user agent, stream format,
 * guide timeshift, and a parental lock for categories.
 */

import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { IptvFrame, useIptvStyles } from "@/components/iptv/bits";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { IPTV_PRESETS, resolveUserAgent } from "@/lib/iptv/http.mjs";
import { readSecret, writeSecret } from "@/lib/secrets";
import { useTheme } from "@/theme";
import { useIptvSession } from "@/store/iptv-session";
import { iptvPinKey, sourcePlayer, useIptv } from "@/store/iptv-store";

export default function PlaylistSettings() {
  const t = useT();
  const styles = useIptvStyles();
  const { colors } = useTheme();
  const sources = useIptv((state) => state.sources);
  const activeId = useIptv((state) => state.activeSourceId);
  const updateSource = useIptv((state) => state.updateSource);
  const globalPreset = useIptv((state) => state.userAgentPreset);
  const globalPlayer = useIptv((state) => state.player);
  const source = sources.find((item) => item.id === activeId) ?? null;
  const items = useIptvSession((state) => (state.sourceId === activeId ? state.items : []));
  const [pin, setPin] = useState("");
  const [offset, setOffset] = useState(String(source?.epgOffsetHours ?? 0));
  const [message, setMessage] = useState("");

  if (!source) {
    return (
      <IptvFrame title={t("Settings")}>
        <Button label={t("Playlists")} onPress={() => router.replace("/(tabs)/iptv")} />
      </IptvFrame>
    );
  }

  const preset = source.userAgentPreset || globalPreset || "vlc";
  const player = sourcePlayer(source, globalPlayer);
  const groups = [...new Set(items.map((item) => item.groupName || item.group).filter(Boolean))].sort();

  const savePin = async () => {
    if (pin.trim().length < 4) {
      setMessage(t("Set a PIN before locking a category."));
      return;
    }
    await writeSecret(iptvPinKey(source.id), pin.trim());
    setPin("");
    setMessage(t("Parental lock"));
  };

  return (
    <IptvFrame title={t("Settings")}>
      <Text style={styles.title}>{source.name}</Text>
      <Text style={styles.copy}>{t("Each playlist can use its own player, user agent, stream format, and guide timeshift.")}</Text>
      <Text style={styles.label}>{t("Player")}</Text>
      <View style={styles.grid}>
        {(
          [
            ["media3", t("Media3")],
            ["vlc", t("libVLC")],
            ["expo", t("Expo player")],
          ] as const
        ).map(([id, label]) => (
          <Pressable key={id} style={[styles.chip, player === id ? styles.chipOn : null]} onPress={() => updateSource(source.id, { player: id })}>
            <Text style={styles.chipText}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>{t("User agent")}</Text>
      <View style={styles.grid}>
        {IPTV_PRESETS.map((item) => (
          <Pressable key={item.id} style={[styles.chip, preset === item.id ? styles.chipOn : null]} onPress={() => updateSource(source.id, { userAgentPreset: item.id })}>
            <Text style={styles.chipText}>{item.label === "Custom" ? t("Custom") : item.label}</Text>
          </Pressable>
        ))}
      </View>
      {preset === "custom" ? (
        <TextInput
          value={source.userAgent}
          onChangeText={(value) => updateSource(source.id, { userAgent: value, userAgentPreset: "custom" })}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="IPTVSmartersPlayer"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      ) : (
        <Text style={styles.meta}>{resolveUserAgent(preset, source.userAgent)}</Text>
      )}
      <Text style={styles.label}>{t("Stream format")}</Text>
      <View style={styles.row}>
        {(["ts", "m3u8"] as const).map((id) => (
          <Pressable key={id} style={[styles.chip, source.streamFormat === id ? styles.chipOn : null]} onPress={() => updateSource(source.id, { streamFormat: id })}>
            <Text style={styles.chipText}>{id}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>{t("EPG timeshift (hours)")}</Text>
      <TextInput
        value={offset}
        onChangeText={setOffset}
        keyboardType="numbers-and-punctuation"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        onEndEditing={() => {
          const hours = Number(offset);
          updateSource(source.id, { epgOffsetHours: Number.isFinite(hours) ? Math.max(-12, Math.min(14, hours)) : 0 });
        }}
      />
      <Text style={styles.label}>{t("Parental lock")}</Text>
      <TextInput value={pin} onChangeText={setPin} secureTextEntry placeholder={t("PIN")} placeholderTextColor={colors.textMuted} style={styles.input} />
      <Button label={t("Parental lock")} size="sm" variant="secondary" onPress={() => void savePin()} />
      {groups.map((name) => {
        const locked = source.lockedGroups.includes(name);
        return (
          <Pressable
            key={name}
            style={styles.menuRow}
            onPress={() => {
              void readSecret(iptvPinKey(source.id)).then((saved) => {
                if (!saved) {
                  setMessage(t("Set a PIN before locking a category."));
                  return;
                }
                const lockedGroups = locked
                  ? source.lockedGroups.filter((item) => item !== name)
                  : [...source.lockedGroups, name];
                updateSource(source.id, { lockedGroups });
              });
            }}
          >
            <Text style={styles.channelTitle}>{name}</Text>
            <Text style={styles.meta}>{locked ? t("Locked") : t("Unlock")}</Text>
          </Pressable>
        );
      })}
      {message ? <Text style={styles.copy}>{message}</Text> : null}
      <Button label={t("Back")} variant="ghost" onPress={() => router.back()} />
    </IptvFrame>
  );
}
