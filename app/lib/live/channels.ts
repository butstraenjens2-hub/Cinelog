/**
 * Legal live channels.
 *
 * In-app playback is limited to streams we verified on the broadcaster's own
 * host: NASA TV (US government, public domain) and France 24 (France Médias
 * Monde's public HLS on live.france24.com, CORS open, playlist responding).
 * DW and NHK WORLD-JAPAN are free official services, but their direct playlist
 * URLs were not confirmed from the broadcaster page, so they open that page
 * instead of playing inside CineLog. No third-party IPTV playlist is bundled.
 */

export interface LegalChannel {
  id: string;
  name: string;
  broadcaster: string;
  language: string;
  summary: string;
  officialUrl: string;
  /** Present only when the playlist is the broadcaster's own public stream. */
  streamUrl?: string;
}

export const LEGAL_CHANNELS: LegalChannel[] = [
  {
    id: "nasa-public",
    name: "NASA TV Public",
    broadcaster: "NASA",
    language: "English",
    summary:
      "NASA TV Public is a free public-domain channel from NASA with mission coverage and agency programming.",
    officialUrl: "https://www.nasa.gov/live/",
    streamUrl:
      "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8",
  },
  {
    id: "nasa-media",
    name: "NASA TV Media",
    broadcaster: "NASA",
    language: "English",
    summary:
      "NASA TV Media is NASA's public-domain media channel for briefings and mission events.",
    officialUrl: "https://www.nasa.gov/live/",
    streamUrl:
      "https://ntv2.akamaized.net/hls/live/2013923/NASA-NTV2-HLS/master.m3u8",
  },
  {
    id: "france24-en",
    name: "France 24 English",
    broadcaster: "France Médias Monde",
    language: "English",
    summary:
      "France 24 English is the free international news channel of France Médias Monde.",
    officialUrl: "https://www.france24.com/en/live",
    streamUrl:
      "https://live.france24.com/hls/live/2037218-b/F24_EN_HI_HLS/master_5000.m3u8",
  },
  {
    id: "france24-fr",
    name: "France 24 Français",
    broadcaster: "France Médias Monde",
    language: "Français",
    summary:
      "France 24 is the free French-language international news channel of France Médias Monde.",
    officialUrl: "https://www.france24.com/fr/direct",
    streamUrl:
      "https://live.france24.com/hls/live/2037179-b/F24_FR_HI_HLS/master_2300.m3u8",
  },
  {
    id: "dw-english",
    name: "DW English",
    broadcaster: "Deutsche Welle",
    language: "English",
    summary:
      "DW English is the free international television service of Germany's public broadcaster. Watch it on DW's official live page.",
    officialUrl: "https://www.dw.com/en/live-tv/s-100825",
  },
  {
    id: "nhk-world",
    name: "NHK WORLD-JAPAN",
    broadcaster: "NHK",
    language: "English",
    summary:
      "NHK WORLD-JAPAN is NHK's free international English service. Watch the live stream on the official NHK page.",
    officialUrl: "https://www3.nhk.or.jp/nhkworld/en/live_tv/",
  },
];
