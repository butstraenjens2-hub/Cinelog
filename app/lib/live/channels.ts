/**
 * Legal live channels.
 *
 * In-app playback is limited to HLS playlists whose media segments respond on
 * the broadcaster's own host: France 24 (France Médias Monde), DW English
 * (Deutsche Welle), and Al Jazeera English and Arabic (getaj.net).
 * NASA's old public HLS master still answers, but its variant playlists 404
 * after NASA TV moved to NASA+, so those rows open the official page.
 * NHK WORLD-JAPAN stays a link as well. No third-party IPTV playlist is bundled.
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
      "NASA replaced the NASA TV channel with NASA+. The old public playlist no longer has playable segments, so this opens NASA's official live page.",
    officialUrl: "https://www.nasa.gov/live/",
  },
  {
    id: "nasa-media",
    name: "NASA+",
    broadcaster: "NASA",
    language: "English",
    summary:
      "NASA+ is NASA's free streaming platform for live events and agency programming. Watch it on the official NASA+ page.",
    officialUrl: "https://plus.nasa.gov/",
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
      "DW English is the free international television service of Germany's public broadcaster Deutsche Welle.",
    officialUrl: "https://www.dw.com/en/live-tv",
    streamUrl:
      "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8",
  },
  {
    id: "aljazeera-en",
    name: "Al Jazeera English",
    broadcaster: "Al Jazeera Media Network",
    language: "English",
    summary:
      "Al Jazeera English is the free international English news channel of Al Jazeera Media Network.",
    officialUrl: "https://www.aljazeera.com/live",
    streamUrl: "https://live-hls-web-aje-fa.getaj.net/AJE/index.m3u8",
  },
  {
    id: "aljazeera-ar",
    name: "Al Jazeera Arabic",
    broadcaster: "Al Jazeera Media Network",
    language: "العربية",
    summary:
      "Al Jazeera Arabic is the free Arabic news channel of Al Jazeera Media Network.",
    officialUrl: "https://www.aljazeera.net/live",
    streamUrl: "https://live-hls-web-aja.getaj.net/AJA/index.m3u8",
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
