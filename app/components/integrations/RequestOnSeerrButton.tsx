/**
 * Request a TMDB title on the viewer's Seerr or Overseerr server.
 * The viewer picks the server, quality profile, folder, and seasons.
 */

import React, { useState } from "react";
import { Modal, Text, View } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { GenrePill } from "@/components/ui/GenrePill";
import { FONTS, RADIUS, SPACING } from "@/constants/theme";
import { makeStyles } from "@/theme";
import {
  requestOnSeerr,
  seerrSeasons,
  seerrServers,
  type SeerrSeason,
  type SeerrServerOption,
} from "@/lib/seerr/api";
import { readSecret, SECRET } from "@/lib/secrets";
import { useIntegrations } from "@/store/integrations-store";

export function RequestOnSeerrButton({
  mediaType,
  tmdbId,
  title,
}: {
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
}) {
  const t = useT();
  const styles = useStyles();
  const url = useIntegrations((state) => state.seerrUrl);
  const [open, setOpen] = useState(false);
  const [servers, setServers] = useState<SeerrServerOption[]>([]);
  const [seasons, setSeasons] = useState<SeerrSeason[]>([]);
  const [serverId, setServerId] = useState<number | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [allSeasons, setAllSeasons] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const server = servers.find((item) => item.id === serverId) ?? servers[0];

  const openPicker = async () => {
    const apiKey = await readSecret(SECRET.seerrApiKey);
    if (!url.trim() || !apiKey) {
      router.push("/integrations/seerr" as never);
      return;
    }
    setOpen(true);
    setBusy(true);
    setMessage(null);
    try {
      const nextServers = await seerrServers(url, apiKey, mediaType);
      setServers(nextServers);
      const first = nextServers[0];
      setServerId(first?.id ?? null);
      setProfileId(first?.profiles[0]?.id ?? null);
      setFolder(first?.folders[0]?.name ?? null);
      if (mediaType === "tv") {
        const nextSeasons = await seerrSeasons(url, apiKey, tmdbId);
        setSeasons(nextSeasons);
        setPicked(nextSeasons.map((season) => season.seasonNumber));
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    const apiKey = await readSecret(SECRET.seerrApiKey);
    setBusy(true);
    setMessage(null);
    try {
      await requestOnSeerr(url, apiKey, {
        mediaType,
        tmdbId,
        serverId: server?.id,
        profileId: profileId ?? undefined,
        rootFolder: folder ?? undefined,
        seasons: mediaType === "tv" ? (allSeasons ? "all" : picked) : undefined,
      });
      setOpen(false);
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : t("Could not reach the server");
      setMessage(/already/i.test(text) ? t("Already requested.") : text);
    } finally {
      setBusy(false);
    }
  };

  const toggleSeason = (seasonNumber: number) => {
    setAllSeasons(false);
    setPicked((current) =>
      current.includes(seasonNumber)
        ? current.filter((value) => value !== seasonNumber)
        : [...current, seasonNumber],
    );
  };

  return (
    <>
      <Button label={t("Request on Seerr")} icon="paper-plane-outline" variant="secondary" size="sm" onPress={() => void openPicker()} />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>{t("Request on Seerr")}</Text>
            <Text style={styles.copy}>{title}</Text>
            <Text style={styles.label}>{t("Server")}</Text>
            <View style={styles.pills}>
              {servers.map((item) => (
                <GenrePill
                  key={item.id}
                  label={item.name}
                  selected={server?.id === item.id}
                  onPress={() => {
                    setServerId(item.id);
                    setProfileId(item.profiles[0]?.id ?? null);
                    setFolder(item.folders[0]?.name ?? null);
                  }}
                />
              ))}
            </View>
            <Text style={styles.label}>{t("Quality profile")}</Text>
            <View style={styles.pills}>
              {(server?.profiles ?? []).map((profile) => (
                <GenrePill
                  key={profile.id || profile.name}
                  label={profile.name}
                  selected={profileId === profile.id}
                  onPress={() => setProfileId(profile.id)}
                />
              ))}
            </View>
            <Text style={styles.label}>{t("Root folder")}</Text>
            <View style={styles.pills}>
              {(server?.folders ?? []).map((item) => (
                <GenrePill key={item.name} label={item.name} selected={folder === item.name} onPress={() => setFolder(item.name)} />
              ))}
            </View>
            {mediaType === "tv" ? (
              <>
                <Text style={styles.label}>{t("Seasons")}</Text>
                <View style={styles.pills}>
                  <GenrePill label={t("All seasons")} selected={allSeasons} onPress={() => setAllSeasons(true)} />
                  {seasons.map((season) => (
                    <GenrePill
                      key={season.seasonNumber}
                      label={season.name}
                      selected={!allSeasons && picked.includes(season.seasonNumber)}
                      onPress={() => toggleSeason(season.seasonNumber)}
                    />
                  ))}
                </View>
              </>
            ) : null}
            {message ? <Text style={styles.error}>{message}</Text> : null}
            {busy ? <Text style={styles.hint}>{t("Testing connection")}</Text> : null}
            <View style={styles.actions}>
              <Button label={t("Cancel")} variant="ghost" size="sm" onPress={() => setOpen(false)} />
              <Button label={t("Request on Seerr")} size="sm" loading={busy} onPress={() => void confirm()} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", padding: SPACING.lg },
  card: { gap: SPACING.sm, padding: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: c.surface },
  title: { fontFamily: FONTS.bold, fontSize: 18, color: c.textPrimary },
  copy: { fontFamily: FONTS.regular, fontSize: 14, color: c.textSecondary },
  label: { fontFamily: FONTS.semibold, fontSize: 13, color: c.textPrimary, marginTop: SPACING.xs },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  hint: { fontFamily: FONTS.regular, fontSize: 12, color: c.textMuted },
  error: { fontFamily: FONTS.medium, fontSize: 13, color: c.error },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: SPACING.sm, marginTop: SPACING.sm },
}));
