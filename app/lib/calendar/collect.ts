/**
 * Upcoming episodes for every followed show, not only the next episode of
 * the first handful. A show with no announced date is omitted because an
 * .ics event needs a day.
 */

import { fetchSeason, fetchSeriesDetail } from "@/lib/cinelog/api";
import type { Series } from "@/lib/cinelog/types";
import { episodeCode, trackedSeries } from "@/lib/cinelog/upNext";
import { useLibrary } from "@/store/library-store";

export interface CalendarEvent {
  uid: string;
  title: string;
  start: string;
  description: string;
}

const DAY = 24 * 60 * 60 * 1000;

export async function collectFollowedCalendar(now = Date.now()): Promise<CalendarEvent[]> {
  const { history, episodes, watchlist } = useLibrary.getState();
  const tracked = trackedSeries(history, episodes, watchlist, 500);
  const events: CalendarEvent[] = [];
  const earliest = now - DAY;

  for (const ref of tracked) {
    const seen = new Set<string>();
    const push = (season: number, episode: number, name: string, airDate: string) => {
      const start = airDate.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || Date.parse(start) < earliest) return;
      const uid = `${ref.id}-s${season}e${episode}-${start}`;
      if (seen.has(uid)) return;
      seen.add(uid);
      events.push({
        uid,
        title: `${ref.title} ${episodeCode(season, episode)}`,
        start,
        description: name,
      });
    };

    try {
      const detail = await fetchSeriesDetail(ref.tmdbId);
      const series = detail.title as Series;
      const seasons = series.seasons.filter((season) => season.seasonNumber > 0);
      for (const season of seasons) {
        if (season.airDate && Date.parse(season.airDate) < earliest && season.seasonNumber < (series.nextEpisode?.seasonNumber ?? 0)) {
          continue;
        }
        const full = await fetchSeason(ref.tmdbId, season.seasonNumber);
        for (const episode of full.episodes) {
          if (episode.airDate) push(episode.seasonNumber, episode.episodeNumber, episode.title, episode.airDate);
        }
      }
      const next = series.nextEpisode;
      if (next?.airDate) push(next.seasonNumber, next.episodeNumber, next.name, next.airDate);
    } catch {
      // One unreachable show does not drop the rest of the calendar.
    }
  }

  return events.sort((left, right) => left.start.localeCompare(right.start));
}
