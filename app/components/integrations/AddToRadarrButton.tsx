/**
 * Movie-page Radarr status and "Add to Radarr".
 * Adding a title does not search indexers unless the viewer opts in.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Modal, Switch, Text, View } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { GenrePill } from "@/components/ui/GenrePill";
import { FONTS, RADIUS, SPACING } from "@/constants/theme";
import { makeStyles, useTheme } from "@/theme";
import { readSecret, SECRET } from "@/lib/secrets";
import {
  addMovieToRadarr,
  radarrMovieState,
  radarrQualityProfiles,
  radarrRootFolders,
  type RadarrOption,
} from "@/lib/radarr/api";
import { useIntegrations } from "@/store/integrations-store";

type MovieState =
  | { kind: "off" }
  | { kind: "checking" }
  | { kind: "missing" }
  | { kind: "library"; downloaded: boolean }
  | { kind: "error"; message: string };

export function AddToRadarrButton({ tmdbId, title }: { tmdbId: number; title: string }) {
  const t = useT();
  const styles = useStyles();
  const { colors } = useTheme();
  const url = useIntegrations((state) => state.radarrUrl);
  const [movieState, setMovieState] = useState<MovieState>({ kind: "off" });
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<RadarrOption[]>([]);
  const [folders, setFolders] = useState<RadarrOption[]>([]);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [search, setSearch] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const apiKey = await readSecret(SECRET.radarrApiKey);
    if (!url.trim() || !apiKey) {
      setMovieState({ kind: "off" });
      return;
    }
    setMovieState({ kind: "checking" });
    try {
      const state = await radarrMovieState(url, apiKey, tmdbId);
      setMovieState(state.inLibrary ? { kind: "library", downloaded: state.downloaded } : { kind: "missing" });
    } catch (cause) {
      setMovieState({
        kind: "error",
        message: cause instanceof Error ? cause.message : t("Could not reach the server"),
      });
    }
  }, [t, tmdbId, url]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openPicker = async () => {
    const apiKey = await readSecret(SECRET.radarrApiKey);
    if (!url.trim() || !apiKey) {
      router.push("/integrations/radarr" as never);
      return;
    }
    setOpen(true);
    setMessage(null);
    setBusy(true);
    try {
      const [nextProfiles, nextFolders] = await Promise.all([
        radarrQualityProfiles(url, apiKey),
        radarrRootFolders(url, apiKey),
      ]);
      setProfiles(nextProfiles);
      setFolders(nextFolders);
      setProfileId(nextProfiles[0]?.id ?? null);
      setFolder(nextFolders[0]?.name ?? null);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!profileId || !folder) return;
    const apiKey = await readSecret(SECRET.radarrApiKey);
    setBusy(true);
    setMessage(null);
    try {
      await addMovieToRadarr(url, apiKey, tmdbId, {
        qualityProfileId: profileId,
        rootFolderPath: folder,
        searchForMovie: search,
      });
      setOpen(false);
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  };

  const status =
    movieState.kind === "checking"
      ? t("Loading")
      : movieState.kind === "library"
        ? `${t("In Radarr")} · ${movieState.downloaded ? t("On disk") : t("Missing file")}`
        : movieState.kind === "missing"
          ? t("Not in Radarr")
          : movieState.kind === "error"
            ? movieState.message
            : null;

  return (
    <>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      {movieState.kind === "library" ? null : (
        <Button label={t("Add to Radarr")} icon="add" variant="secondary" size="sm" onPress={() => void openPicker()} />
      )}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>{t("Add to Radarr")}</Text>
            <Text style={styles.copy}>{title}</Text>
            <Text style={styles.label}>{t("Quality profile")}</Text>
            <View style={styles.pills}>
              {profiles.map((profile) => (
                <GenrePill
                  key={profile.id}
                  label={profile.name}
                  selected={profileId === profile.id}
                  onPress={() => setProfileId(profile.id)}
                />
              ))}
            </View>
            <Text style={styles.label}>{t("Root folder")}</Text>
            <View style={styles.pills}>
              {folders.map((item) => (
                <GenrePill
                  key={item.name}
                  label={item.name}
                  selected={folder === item.name}
                  onPress={() => setFolder(item.name)}
                />
              ))}
            </View>
            <View style={styles.toggle}>
              <Text style={styles.copy}>{t("Also ask Radarr to search for this movie")}</Text>
              <Switch
                value={search}
                onValueChange={setSearch}
                trackColor={{ false: colors.surfaceHover, true: colors.accent }}
                thumbColor={colors.textPrimary}
              />
            </View>
            <Text style={styles.hint}>
              {t("Searching uses whatever indexers are already configured on your server. CineLog does not add any.")}
            </Text>
            {message ? <Text style={styles.error}>{message}</Text> : null}
            {busy ? <Text style={styles.hint}>{t("Testing connection")}</Text> : null}
            <View style={styles.actions}>
              <Button label={t("Cancel")} variant="ghost" size="sm" onPress={() => setOpen(false)} />
              <Button
                label={t("Add to Radarr")}
                size="sm"
                loading={busy}
                disabled={!profileId || !folder}
                onPress={() => void confirm()}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  status: { fontFamily: FONTS.medium, fontSize: 14, color: c.textSecondary },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  card: {
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.border,
  },
  title: { fontFamily: FONTS.bold, fontSize: 18, color: c.textPrimary },
  label: { fontFamily: FONTS.semibold, fontSize: 13, color: c.textPrimary },
  copy: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, color: c.textSecondary },
  hint: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, color: c.textMuted },
  error: { fontFamily: FONTS.medium, fontSize: 13, color: c.error },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  toggle: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: SPACING.sm },
}));
