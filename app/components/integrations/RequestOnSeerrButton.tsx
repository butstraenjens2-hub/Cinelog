/**
 * Sends a TMDB id to the viewer's Seerr or Overseerr server.
 * Opens setup when the server is not configured.
 */

import React, { useState } from "react";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { requestOnSeerr } from "@/lib/seerr/api";
import { readSecret, SECRET } from "@/lib/secrets";
import { useIntegrations } from "@/store/integrations-store";

export function RequestOnSeerrButton({
  mediaType,
  tmdbId,
}: {
  mediaType: "movie" | "tv";
  tmdbId: number;
}) {
  const t = useT();
  const url = useIntegrations((state) => state.seerrUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const press = async () => {
    const apiKey = await readSecret(SECRET.seerrApiKey);
    if (!url.trim() || !apiKey) {
      router.push("/integrations/seerr" as never);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await requestOnSeerr(url, apiKey, mediaType, tmdbId);
      setMessage(t("Request sent."));
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : t("Could not reach the server");
      setMessage(/already/i.test(text) ? t("Already requested.") : text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      label={message || t("Request on Seerr")}
      icon="paper-plane-outline"
      variant="secondary"
      size="sm"
      loading={busy}
      onPress={() => void press()}
    />
  );
}
