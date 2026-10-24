/**
 * Saved playlists. CineLog does not ship one.
 */

import React, { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { SeoHead } from "@/components/SeoHead";
import { IptvFrame, useIptvStyles } from "@/components/iptv/bits";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { writeSecret } from "@/lib/secrets";
import { iptvPasswordKey, useIptv } from "@/store/iptv-store";
import { useIptvSession } from "@/store/iptv-session";

function expiryLabel(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

export default function PlaylistList() {
  const t = useT();
  const styles = useIptvStyles();
  const sources = useIptv((state) => state.sources);
  const setActive = useIptv((state) => state.setActiveSource);
  const removeSource = useIptv((state) => state.removeSource);
  const [confirmId, setConfirmId] = useState("");

  return (
    <>
      <SeoHead title="IPTV" description="Play a playlist you add yourself." />
      <IptvFrame title="IPTV">
        <Text style={styles.kicker}>{t("Playlists")}</Text>
        <Text style={styles.copy}>
          {t("CineLog does not include any playlist. Add your own M3U URL, M3U file, or Xtream login.")}
        </Text>
        <Button label={t("Add playlist")} onPress={() => router.push("/(tabs)/iptv/edit")} />
        {sources.map((source) => {
          const counts = source.counts;
          const account = source.account;
          return (
            <Pressable
              key={source.id}
              style={styles.card}
              onPress={() => {
                setActive(source.id);
                router.push("/(tabs)/iptv/home");
              }}
            >
              <Text style={styles.tileTitle}>{source.name}</Text>
              <Text style={styles.meta}>{source.kind === "xtream" ? t("Xtream login") : t("M3U playlist")}</Text>
              {account?.status ? (
                <Text style={styles.meta}>
                  {t("Account status")}: {account.status}
                  {account.expiry ? ` · ${t("Expiry")} ${expiryLabel(account.expiry)}` : ""}
                </Text>
              ) : null}
              {counts ? (
                <Text style={styles.meta}>
                  {t("Live {{count}}", { count: counts.live })}
                  {" · "}
                  {t("Movies {{count}}", { count: counts.movie })}
                  {" · "}
                  {t("Series {{count}}", { count: counts.series })}
                </Text>
              ) : null}
              {source.lastError ? <Text style={styles.error}>{t(source.lastError)}</Text> : null}
              {source.updatedAt ? (
                <Text style={styles.meta}>{t("Updated {{time}}", { time: new Date(source.updatedAt).toLocaleString() })}</Text>
              ) : (
                <Text style={styles.meta}>{t("Not loaded yet")}</Text>
              )}
              <View style={styles.row}>
                <Button
                  label={t("Edit playlist")}
                  size="sm"
                  variant="secondary"
                  onPress={() => router.push({ pathname: "/(tabs)/iptv/edit", params: { id: source.id } })}
                />
                <Button
                  label={confirmId === source.id ? t("Delete playlist") : t("Remove")}
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    if (confirmId !== source.id) {
                      setConfirmId(source.id);
                      return;
                    }
                    void writeSecret(iptvPasswordKey(source.id), "");
                    if (useIptvSession.getState().sourceId === source.id) {
                      useIptvSession.setState({ sourceId: "", items: [], phase: "idle", diagnosis: null, error: null });
                    }
                    removeSource(source.id);
                    setConfirmId("");
                  }}
                />
              </View>
            </Pressable>
          );
        })}
      </IptvFrame>
    </>
  );
}
