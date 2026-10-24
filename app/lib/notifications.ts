/**
 * CineLog — local notifications.
 *
 * Everything here is scheduled on the device, so the reminders work without a
 * push backend:
 *
 *  - New releases: a one-off reminder on the release date of each watchlist
 *    title that hasn't come out yet.
 *  - New episodes: a reminder on the air date of the next announced episode of
 *    each followed series (TMDB `next_episode_to_air`).
 *  - Recommendations: a weekly nudge towards the personalised rail.
 *  - Watchlist reminders: a weekly nudge about titles saved but not watched.
 *
 * The whole module is best-effort. Notifications are a nicety, so a denied
 * permission or an unavailable module must never surface as an error, and the
 * web build skips scheduling entirely because Expo's scheduler is native-only.
 */

import { Platform } from "react-native";

import type { NotificationPrefs } from "@/store/settings-store";
import type { WatchlistItem } from "@/lib/cinelog/types";
import { episodeCode, type UpcomingEpisode } from "@/lib/cinelog/upNext";
import { translate } from "@/i18n";

/** Scheduling a reminder for every saved title would flood the queue. */
const MAX_RELEASE_REMINDERS = 20;
const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;
const MAX_EPISODE_REMINDERS = 20;
/** Episode reminders fire at this local hour on the air date. */
const EPISODE_REMINDER_HOUR = 18;

function episodeReminderDate(airDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(airDate);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    EPISODE_REMINDER_HOUR,
  );
  return date.getTime() > Date.now() ? date : null;
}

type NotificationsModule = typeof import("expo-notifications");

let modulePromise: Promise<NotificationsModule | null> | null = null;

async function loadModule(): Promise<NotificationsModule | null> {
  if (Platform.OS === "web") return null;
  if (!modulePromise) {
    modulePromise = import("expo-notifications").catch(() => null);
  }
  return modulePromise;
}

async function ensurePermission(
  notifications: NotificationsModule,
): Promise<boolean> {
  try {
    const current = await notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

function releaseReminders(watchlist: WatchlistItem[]) {
  const now = Date.now();
  return watchlist
    .map((item) => {
      if (!item.releaseDate) return null;
      const releaseAt = Date.parse(item.releaseDate);
      if (!Number.isFinite(releaseAt) || releaseAt <= now) return null;
      return { item, releaseAt };
    })
    .filter(
      (entry): entry is { item: WatchlistItem; releaseAt: number } =>
        entry !== null,
    )
    .sort((left, right) => left.releaseAt - right.releaseAt)
    .slice(0, MAX_RELEASE_REMINDERS);
}

/**
 * Rebuild the scheduled queue from the current preferences and watchlist.
 * Cancelling first keeps this idempotent — it can run on every change.
 */
export async function syncNotifications(
  prefs: NotificationPrefs,
  watchlist: WatchlistItem[],
  upcomingEpisodes: UpcomingEpisode[] = [],
): Promise<void> {
  const notifications = await loadModule();
  if (!notifications) return;

  const wantsEpisodes = prefs.newEpisodes !== false;
  const wantsAny =
    prefs.newReleases ||
    wantsEpisodes ||
    prefs.recommendations ||
    prefs.watchlistReminders;

  try {
    await notifications.cancelAllScheduledNotificationsAsync();
    if (!wantsAny) return;
    if (!(await ensurePermission(notifications))) return;

    const { SchedulableTriggerInputTypes } = notifications;
    if (Platform.OS === "android") {
      await notifications.setNotificationChannelAsync("cinelog", {
        name: "CineLog",
        importance: notifications.AndroidImportance.DEFAULT,
      });
    }

    if (prefs.newReleases) {
      for (const { item, releaseAt } of releaseReminders(watchlist)) {
        await notifications.scheduleNotificationAsync({
          content: {
            title: translate("{{title}} is out today", { title: item.title }),
            body: translate("It's on your watchlist — time to watch."),
            data: { type: "release", id: item.id },
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DATE,
            date: new Date(releaseAt),
            channelId: "cinelog",
          },
        });
      }
    }

    if (wantsEpisodes) {
      for (const episode of upcomingEpisodes.slice(0, MAX_EPISODE_REMINDERS)) {
        const at = episodeReminderDate(episode.airDate);
        if (!at) continue;
        await notifications.scheduleNotificationAsync({
          content: {
            title: translate("New episode of {{title}}", {
              title: episode.series.title,
            }),
            body: translate("{{code}} {{name}} is out today.", {
              code: episodeCode(episode.seasonNumber, episode.episodeNumber),
              name: episode.name || "",
            }),
            data: {
              type: "episode",
              id: episode.series.id,
              url: `/series/${episode.series.tmdbId}?season=${episode.seasonNumber}`,
            },
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DATE,
            date: at,
            channelId: "cinelog",
          },
        });
      }
    }

    if (prefs.recommendations) {
      await notifications.scheduleNotificationAsync({
        content: {
          title: translate("New picks for you"),
          body: translate(
            "We lined up fresh recommendations based on your taste.",
          ),
          data: { type: "recommendations" },
        },
        trigger: {
          type: SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: WEEK_IN_SECONDS,
          repeats: true,
          channelId: "cinelog",
        },
      });
    }

    if (prefs.watchlistReminders && watchlist.length > 0) {
      await notifications.scheduleNotificationAsync({
        content: {
          title: translate("Still on your watchlist"),
          body: translate("{{count}} titles are waiting for you.", {
            count: watchlist.length,
          }),
          data: { type: "watchlist" },
        },
        trigger: {
          type: SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: WEEK_IN_SECONDS,
          repeats: true,
          channelId: "cinelog",
        },
      });
    }
  } catch {
    // Reminders are optional; never let scheduling break the app.
  }
}
