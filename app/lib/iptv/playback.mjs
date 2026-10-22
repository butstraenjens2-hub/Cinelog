/**
 * How a viewer-supplied stream should be opened.
 * MPEG-TS uses a progressive source and TsExtractor. HLS uses the HLS source.
 * MP4 and MKV use a progressive source. No playlist is bundled here.
 */

export function playbackPlan(url) {
  let path = "";
  try {
    path = new URL(String(url)).pathname.toLowerCase();
  } catch {
    path = String(url || "").split("?")[0].toLowerCase();
  }
  if (path.endsWith(".m3u8")) return { source: "hls", mime: "application/vnd.apple.mpegurl" };
  if (path.endsWith(".ts")) return { source: "mpegts", mime: "video/mp2t" };
  if (path.endsWith(".mkv")) return { source: "progressive", mime: "video/x-matroska" };
  if (path.endsWith(".mp4") || path.endsWith(".m4v") || path.endsWith(".mov")) {
    return { source: "progressive", mime: "video/mp4" };
  }
  return { source: "progressive", mime: "" };
}
