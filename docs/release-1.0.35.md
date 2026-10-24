# CineLog 1.0.35

Stream-embed code was not modified, and the film and series stream server is unchanged. No indexer, download client, or bundled playlist was added.

## Integrations that now do more

1. **Poster widgets.** The compact widget shows the up-next poster beside the title. The large widget is a 2×2 poster grid. Posters are downloaded on the device and scaled before they are drawn.
2. **Seerr picker.** A request can choose the server, quality profile, root folder, and, for a series, all seasons or specific seasons.
3. **Jellyfin resume.** The library screen lists Continue watching and seeks to that position. Playback reports progress about every 10 seconds.
4. **SIMKL ratings and watching.** Pull applies a 1–10 rating when the device has none. A show marked watching is stored as watching and added to the watchlist even when SIMKL sent no episode rows.
5. **Kodi library.** The remote can list movies and shows, open a show’s episodes, and play a movie or episode on the Kodi device.
6. **Tautulli stop.** An active session can be stopped after a confirmation dialog.
7. **Calendar.** Sharing the calendar walks followed shows (up to 500) and includes future episode air dates. A show with no announced date is omitted, because an `.ics` event needs a day.

## Tablet navigation and settings

The top navigation stays on one row. Each item keeps its full label. When the row is wider than the screen, swipe left or right to reach the rest. The phone bar scrolls the same way.

Settings is grouped into Account and profiles, Playback, Integrations (Sonarr, Radarr, Trakt, SIMKL, Jellyfin, Seerr, Tautulli, Kodi), Live TV and IPTV, Notifications, and About.

## IPTV

A new IPTV tab plays a playlist the viewer adds. They can paste an M3U or M3U8 URL, import an M3U file, or sign in to their own Xtream Codes server. The password is stored in the device keystore. An optional XMLTV URL fills the guide. Live, Movies, and Series are separate lists, with categories, search, favourites, the current programme, and catch-up when the server says the channel has an archive. The tab is empty until the viewer adds a source. CineLog does not ship a playlist.

## Live TV

Live playback uses a texture view on Android so the picture is visible inside the page, sends a browser user agent, and does not loop a live HLS playlist. France 24, DW English, Al Jazeera English, and Al Jazeera Arabic play from the broadcaster’s own public HLS. Each of those playlists returned a clear MPEG-TS segment. NASA’s old public master still answers, but its variant playlists no longer exist after NASA TV moved to NASA+, so NASA+ and NHK WORLD-JAPAN open their official pages instead of a black player.

## Still out of scope

- Jellyfin/Emby still has no SyncPlay, downloads, or Live TV tuner.
- Android TV is still the 10-foot layout of this React Native app, not a separate Leanback activity.
- Profiles stay on the device. They are not cloud accounts.
- Seerr still does not add indexers or download clients.
- IPTV only plays what the viewer supplies. There is no bundled M3U or Xtream server.
