/**
 * Loads the active playlist into memory and reports download progress.
 * Cancelling bumps a generation so a late response cannot overwrite the screen.
 */

import * as FileSystem from "expo-file-system/legacy";

import { sectionCounts } from "@/lib/iptv/m3u.mjs";
import {
  loadM3uText,
  loadM3uUrl,
  loadXtreamCatalogue,
  type PlaylistDiagnosis,
  type PlaylistLoad,
} from "@/lib/iptv/load";
import { cancelDownload, subscribeDownload } from "@/lib/iptv/transport";
import { readSecret } from "@/lib/secrets";
import { useIptvSession } from "@/store/iptv-session";
import { iptvPasswordKey, sourceAgent, useIptv, type IptvSource } from "@/store/iptv-store";

let generation = 0;

function cancelledMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  return message === "Cancelled" || message.includes("Cancelled");
}

export async function refreshPlaylist(source: IptvSource) {
  const token = ++generation;
  const preset = useIptv.getState().userAgentPreset;
  const custom = useIptv.getState().userAgent;
  const agent = sourceAgent(source, preset, custom);
  useIptvSession.getState().begin(source.id);
  const subscription = subscribeDownload((event) => {
    if (token !== generation) return;
    const phase = event.phase === "parsing" ? "parsing" : "download";
    useIptvSession.getState().progress(phase, Number(event.bytes || 0), Number(event.count || 0));
  });
  try {
    let loaded: PlaylistLoad;
    if (source.kind === "m3u" && source.fileUri) {
      const text = await FileSystem.readAsStringAsync(source.fileUri);
      loaded = loadM3uText(text);
    } else if (source.kind === "m3u") {
      loaded = await loadM3uUrl(source.url, agent);
    } else {
      const password = await readSecret(iptvPasswordKey(source.id));
      if (!password) throw new Error("The saved Xtream password is missing. Add the playlist again.");
      const catalogue = await loadXtreamCatalogue(source.server, source.username, password, agent);
      const counts = sectionCounts(catalogue.items) as PlaylistLoad["counts"];
      const diagnosis: PlaylistDiagnosis | null = catalogue.items.length
        ? null
        : {
            reason: catalogue.warnings[0] ? "empty catalogue" : "empty catalogue",
            snippet: "",
            status: 0,
            contentType: "",
            bytes: 0,
            details: catalogue.warnings.length
              ? catalogue.warnings
              : ["The server returned no channels, movies, or series."],
          };
      loaded = { items: catalogue.items, counts, diagnosis, warnings: catalogue.warnings };
    }
    if (token !== generation) return;
    useIptvSession.getState().ready(source.id, loaded.items, loaded.counts, loaded.diagnosis, loaded.warnings);
    useIptv.getState().setCatalogueMeta(source.id, loaded.counts, Date.now(), loaded.diagnosis?.reason || "");
  } catch (cause) {
    if (token !== generation) return;
    const message = cancelledMessage(cause)
      ? "The download was cancelled."
      : cause instanceof Error
        ? cause.message
        : "Could not reach the server";
    useIptvSession.getState().fail(source.id, message);
    useIptv.getState().setCatalogueMeta(source.id, { live: 0, movie: 0, series: 0 }, Date.now(), message);
  } finally {
    subscription.remove();
  }
}

export function cancelRefresh() {
  generation += 1;
  const sourceId = useIptvSession.getState().sourceId;
  void cancelDownload();
  useIptvSession.getState().fail(sourceId, "The download was cancelled.");
}
