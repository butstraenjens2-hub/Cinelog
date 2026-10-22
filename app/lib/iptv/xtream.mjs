/**
 * Xtream Codes URL builder for an account the viewer typed in.
 * The password stays in the device keystore. These URLs are built only when
 * playback or a catalogue request needs them.
 */

function originOf(server) {
  const url = new URL(String(server ?? "").trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }
  return url.origin;
}

function pathPart(value) {
  return encodeURIComponent(String(value ?? ""));
}

export function xtreamApiUrl(server, username, password, action, query = {}) {
  const url = new URL("/player_api.php", originOf(server));
  url.searchParams.set("username", username);
  url.searchParams.set("password", password);
  if (action) url.searchParams.set("action", action);
  for (const [name, value] of Object.entries(query)) {
    if (value == null || value === "") continue;
    url.searchParams.set(name, String(value));
  }
  return url.toString();
}

export function xtreamLiveUrl(server, username, password, streamId) {
  return `${originOf(server)}/live/${pathPart(username)}/${pathPart(password)}/${pathPart(streamId)}.m3u8`;
}

export function xtreamVodUrl(server, username, password, streamId, extension = "mp4") {
  const ext = String(extension || "mp4").replace(/^\./, "");
  return `${originOf(server)}/movie/${pathPart(username)}/${pathPart(password)}/${pathPart(streamId)}.${ext}`;
}

export function xtreamEpisodeUrl(server, username, password, episodeId, extension = "mp4") {
  const ext = String(extension || "mp4").replace(/^\./, "");
  return `${originOf(server)}/series/${pathPart(username)}/${pathPart(password)}/${pathPart(episodeId)}.${ext}`;
}

/** `start` is `YYYY-MM-DD:HH-mm` in UTC. Duration is minutes. */
export function xtreamCatchupUrl(server, username, password, streamId, start, durationMinutes) {
  return `${originOf(server)}/timeshift/${pathPart(username)}/${pathPart(password)}/${pathPart(durationMinutes)}/${pathPart(start)}/${pathPart(streamId)}.m3u8`;
}

export function formatCatchupStart(epochMs) {
  const date = new Date(epochMs);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}:${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}`;
}

export function mapXtreamCategories(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      id: String(row?.category_id ?? ""),
      name: String(row?.category_name ?? "").trim(),
    }))
    .filter((row) => row.id && row.name);
}

export function mapXtreamStreams(rows, kind) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const id = row?.stream_id ?? row?.series_id;
      if (id == null) return null;
      const archive = Number(row?.tv_archive) === 1;
      return {
        id: String(id),
        name: String(row?.name ?? row?.title ?? "Untitled"),
        group: String(row?.category_id ?? ""),
        tvgId: String(row?.epg_channel_id ?? ""),
        logo: String(row?.stream_icon ?? row?.cover ?? ""),
        streamId: Number(row?.stream_id ?? row?.series_id) || 0,
        extension: String(row?.container_extension ?? (kind === "live" ? "m3u8" : "mp4")),
        archiveHours: archive ? Number(row?.tv_archive_duration) || 0 : 0,
        kind,
      };
    })
    .filter(Boolean);
}
