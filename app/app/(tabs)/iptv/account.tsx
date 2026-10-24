/**
 * Account snapshot reported by an Xtream server the viewer added.
 */

import React, { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { IptvFrame, useIptvStyles } from "@/components/iptv/bits";
import { Button } from "@/components/ui/Button";
import { loadXtreamAccount } from "@/lib/iptv/load";
import { readSecret } from "@/lib/secrets";
import { iptvPasswordKey, sourceAgent, useIptv } from "@/store/iptv-store";

export default function AccountScreen() {
  const t = useT();
  const styles = useIptvStyles();
  const sources = useIptv((state) => state.sources);
  const activeId = useIptv((state) => state.activeSourceId);
  const updateSource = useIptv((state) => state.updateSource);
  const preset = useIptv((state) => state.userAgentPreset);
  const customAgent = useIptv((state) => state.userAgent);
  const source = sources.find((item) => item.id === activeId) ?? null;
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!source || source.kind !== "xtream") return;
    setBusy(true);
    setMessage("");
    try {
      const password = await readSecret(iptvPasswordKey(source.id));
      if (!password) throw new Error(t("The saved Xtream password is missing. Add the playlist again."));
      const account = await loadXtreamAccount(source.server, source.username, password, sourceAgent(source, preset, customAgent));
      updateSource(source.id, { account });
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  };

  if (!source) {
    return (
      <IptvFrame title={t("Account info")}>
        <Button label={t("Playlists")} onPress={() => router.replace("/(tabs)/iptv")} />
      </IptvFrame>
    );
  }

  const account = source.account;
  return (
    <IptvFrame title={t("Account info")}>
      <Text style={styles.title}>{t("Account info")}</Text>
      {source.kind !== "xtream" ? <Text style={styles.copy}>{t("This playlist has no Xtream account.")}</Text> : null}
      {account ? (
        <>
          <Text style={styles.copy}>{t("Account status")}: {account.status || "—"}</Text>
          <Text style={styles.copy}>{t("Expiry")}: {account.expiry ? new Date(account.expiry).toLocaleString() : "—"}</Text>
          <Text style={styles.copy}>{t("Max connections")}: {account.maxConnections || "—"}</Text>
          <Text style={styles.copy}>{t("Active connections")}: {account.activeConnections || "—"}</Text>
          {account.message ? <Text style={styles.meta}>{account.message}</Text> : null}
        </>
      ) : source.kind === "xtream" ? <Text style={styles.copy}>{t("Not loaded yet")}</Text> : null}
      {message ? <Text style={styles.error}>{message}</Text> : null}
      {source.kind === "xtream" ? <Button label={t("Refresh playlist")} loading={busy} onPress={() => void refresh()} /> : null}
      <Button label={t("Back")} variant="ghost" onPress={() => router.back()} />
    </IptvFrame>
  );
}
