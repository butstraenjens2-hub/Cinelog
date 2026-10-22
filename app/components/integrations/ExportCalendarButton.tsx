/**
 * Shares upcoming episodes of followed series as an .ics file.
 */

import React, { useState } from "react";

import { useT } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { collectFollowedCalendar } from "@/lib/calendar/collect";
import { shareIcs } from "@/lib/calendar/share";

export function ExportCalendarButton() {
  const t = useT();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const press = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const events = await collectFollowedCalendar();
      const result = await shareIcs(events);
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
