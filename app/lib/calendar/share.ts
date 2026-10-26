/**
 * Writes an .ics file and opens the system share sheet.
 * Falls back to sharing the text if the share module is unavailable.
 */

import { Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

import { buildIcs } from "@/lib/calendar/ics.mjs";

export async function shareIcs(
  events: Array<{ uid: string; title: string; start: string; description?: string }>,
): Promise<"shared" | "empty"> {
  if (!events.length) return "empty";
  const contents = buildIcs(events);
  const directory = FileSystem.cacheDirectory;
  if (directory) {
    const path = `${directory}cinelog-upcoming.ics`;
    await FileSystem.writeAsStringAsync(path, contents, { encoding: "utf8" });
    try {
      const Sharing = await import("expo-sharing");
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: "text/calendar",
          UTI: "com.apple.ical.ics",
          dialogTitle: "CineLog calendar",
        });
        return "shared";
      }
    } catch {
      // Share the text when the native share sheet cannot open the file.
    }
  }
  await Share.share({ title: "CineLog.ics", message: contents });
  return "shared";
}
