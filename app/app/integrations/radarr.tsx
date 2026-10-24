import React, { useCallback } from "react";

import { ServarrScreen, type ServarrSnapshot } from "@/components/integrations/ServarrScreen";
import { useT } from "@/i18n";
import {
  radarrCalendar,
  radarrHistory,
  radarrMissing,
  radarrMovies,
  radarrQueue,
  testRadarr,
} from "@/lib/radarr/api";
import { useIntegrations } from "@/store/integrations-store";

export default function RadarrScreen() {
  const t = useT();
  const url = useIntegrations((state) => state.radarrUrl);
  const setUrl = useIntegrations((state) => state.setRadarrUrl);

  const load = useCallback(async (baseUrl: string, apiKey: string): Promise<ServarrSnapshot> => {
    const [status, movies, missing, calendar, queue, history] = await Promise.all([
      testRadarr(baseUrl, apiKey),
      radarrMovies(baseUrl, apiKey),
      radarrMissing(baseUrl, apiKey),
      radarrCalendar(baseUrl, apiKey),
      radarrQueue(baseUrl, apiKey),
      radarrHistory(baseUrl, apiKey),
    ]);
    return {
      status,
      library: movies.map((item) => ({
        id: String(item.id),
        title: item.year ? `${item.title} (${item.year})` : item.title,
        meta: [
          item.monitored ? t("Monitored") : t("Unmonitored"),
          item.hasFile ? t("On disk") : t("Missing file"),
          item.status,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
      missing,
      calendar,
      queue,
      history,
    };
  }, [t]);

  return (
    <ServarrScreen
      title="Radarr"
      blurb={t(
        "Connect your own Radarr server to see movies, missing files, the calendar, queue and history.",
      )}
      url={url}
      onSaveUrl={setUrl}
      secretKey="cinelog.radarr.apiKey"
      load={load}
    />
  );
}
