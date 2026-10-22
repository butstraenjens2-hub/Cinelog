/**
 * Shares upcoming episodes of followed series as an .ics file.
 */

import React, { useState } from "react";

import { useT } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { shareIcs } from "@/lib/calendar/share";
import { episodeCode } from "@/lib/cinelog/upNext";
import { useTrackedSeries } from "@/hooks/useTrackedSeries";

export function ExportCalendarButton() {
  const t = useT();
  const { upcoming } = useTrackedSeries(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const press = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await shareIcs(
        upcoming.map((episode) => ({
          uid: `${episode.series.id}-s${episode.seasonNumber}e${episode.episodeNumber}-${episode.airDate}`,
          title: `${episode.series.title} ${episodeCode(episode.seasonNumber, episode.episodeNumber)}`,
          start: episode.airDate,
          description: episode.name || "",
        })),
      );
      setMessage(result === "empty" ? t("No upcoming episodes to export.") : t("Calendar shared."));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      label={message || t("Share calendar")}
      icon="calendar-outline"
      variant="secondary"
      size="sm"
      loading={busy}
      onPress={() => void press()}
    />
  );
}
