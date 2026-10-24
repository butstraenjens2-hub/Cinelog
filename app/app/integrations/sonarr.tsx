import React, { useCallback } from "react";

import { ServarrScreen, type ServarrSnapshot } from "@/components/integrations/ServarrScreen";
import { useT } from "@/i18n";
import {
  sonarrCalendar,
  sonarrHistory,
  sonarrMissing,
  sonarrQueue,
  sonarrSeries,
  testSonarr,
} from "@/lib/sonarr/api";
import { useIntegrations } from "@/store/integrations-store";

export default function SonarrScreen() {
  const t = useT();
  const url = useIntegrations((state) => state.sonarrUrl);
  const setUrl = useIntegrations((state) => state.setSonarrUrl);

  const load = useCallback(async (baseUrl: string, apiKey: string): Promise<ServarrSnapshot> => {
    const [status, series, missing, calendar, queue, history] = await Promise.all([
      testSonarr(baseUrl, apiKey),
      sonarrSeries(baseUrl, apiKey),
      sonarrMissing(baseUrl, apiKey),
      sonarrCalendar(baseUrl, apiKey),
      sonarrQueue(baseUrl, apiKey),
      sonarrHistory(baseUrl, apiKey),
    ]);
    return {
      status,
      library: series.map((item) => ({
        id: String(item.id),
        title: item.year ? `${item.title} (${item.year})` : item.title,
        meta: t(
          item.monitored
            ? "{{files}} of {{total}} episodes on disk · Monitored"
            : "{{files}} of {{total}} episodes on disk · Unmonitored",
          {
            files: item.episodeFileCount,
            total: item.totalEpisodeCount || item.episodeCount,
          },
        ),
      })),
      missing,
      calendar,
      queue,
      history,
    };
  }, [t]);

  return (
    <ServarrScreen
      title="Sonarr"
      blurb={t(
        "Connect your own Sonarr server to see series, missing episodes, the calendar, queue and history.",
      )}
      url={url}
      onSaveUrl={setUrl}
      secretKey="cinelog.sonarr.apiKey"
      load={load}
    />
  );
}
