# CineLog 1.0.33

Choices for this release. The existing stream-embed code and its adblock were not modified.

## Sonarr and Radarr

Both use the public REST API v3 (`X-Api-Key` header only). No Sonarr, Radarr, or Servarr source was copied.

- Settings: server URL plus API key. The key is stored with `expo-secure-store` (Android keystore / iOS keychain). On the web it stays in memory for the session.
- Connection test: `GET /api/v3/system/status`.
- Library with monitored state and episode-file or movie-file status, missing list (`/api/v3/wanted/missing`), calendar, queue, and history.
- "Add to Sonarr" on a TMDB series page and "Add to Radarr" on a movie page. The viewer picks a quality profile and root folder. Searching the server's indexers stays off unless they opt in. CineLog does not ship indexers or download clients.
- Screens explain what to do when a server is not configured, and the add button opens setup instead of failing.

## Trakt

Optional. The viewer creates their own application at trakt.tv and enters the client id and secret (secret in the keystore). Device-code OAuth, then push/pull of the watchlist, watched movies and episodes, and playback positions. A toggle can push later local changes. Pulls only add missing items.

## Live TV

Surveyed players and guides:

- [expo-video](https://github.com/expo/expo/tree/sdk-54/packages/expo-video) (MIT) wraps AndroidX Media3 / ExoPlayer. This is the in-app player.
- [OpenTV](https://github.com/opentvproject/opentv) (GPL-3) has an XMLTV guide and ExoPlayer. GPL code was not copied.
- [Prysm](https://github.com/dereferencex/prysm) (MIT) is an M3U IPTV player. Its playlist importer was not added, because a general playlist import would accept unlicensed streams.

The guide is an original XMLTV subset parser plus a channel grid. The bundled guide describes the channels below. It is not a scraped listings feed and not an iptv-org playlist.

In-app playback, verified on 22 Oct 2026 (HTTP 200, `application/x-mpegURL`, broadcaster-owned host):

- NASA TV Public and NASA TV Media. US government work, public domain. Official Akamai playlists.
- France 24 English and French. Public international news from France Médias Monde, playlist on `live.france24.com`, CORS `*`.

Official pages only (no in-app stream), because a stable official playlist URL was not confirmed from the broadcaster:

- DW English (`dw.com` live page)
- NHK WORLD-JAPAN (free international service; watch on the official live page)

Left out on purpose:

- iptv-org and any other third-party M3U/IPTV list
- User-supplied playlist or Xtream login
- Belgian FTA simulcasts (VRT, RTBF). Their internet streams are geo-restricted and often DRM, so they are not clearly legal to play here
- Arte and other geo-blocked public simulcasts
- Torrent, usenet, and download-client integrations

## Catalogue

- Watch providers stay on TMDB/JustWatch. The region defaults to Belgium and can be changed in Settings (BE, NL, FR, DE, GB, US).
- "Streaming in Belgium" uses TMDB discover with `watch_region=BE`.
- Series filters add TMDB "airing today" and "on the air".
- Movie pages show the TMDB collection and its other films.
- Search returns people through the media API (not only a client TMDB key), filters by release year, sorts by rating or year, and loads further pages.

## Performance

- OkHttp disk cache (40 MB) on the React Native networking client.
- `expo-image` already uses memory and disk. The home screen now prefetches the first trending posters, and search photos use the same cache policy.
- Browse pagination was already infinite; the browse result object is memoized so grids skip extra renders. Search is paginated.
- Notification scheduling waits until after the first interactions so it does not compete with startup.
- R8 minify and resource shrinking were already on. A startup baseline profile and `androidx.profileinstaller` were added. The profile lists the application and activity startup methods; a device-measured profile would be tighter but needs a connected phone.
- Hermes stays on. JS bundle compression stays off so startup does not pay a decompress step.

## Android home-screen widget

A small widget shows the next episode of a followed show, or the first watchlist title, and opens that title. It is original code, not a third-party widget kit.

## Comparable apps, ranked ideas not built here

Effort is relative to this codebase (small: one screen or client, medium: a new subsystem, large: a new platform).

1. Jellyfin or Emby library for the viewer's own server. [Jellyfin](https://github.com/jellyfin/jellyfin), [Findroid](https://github.com/jarnedemeulemeester/findroid). Medium. Legal when it only plays the user's library. Not a stream-embed change.
2. Seerr / Overseerr requests against the viewer's own server. [seerr](https://github.com/seerr-team/seerr), pattern from [LunaSea](https://github.com/CometTools/LunaSea). Medium.
3. Calendar export (ICS) of upcoming episodes. [SeriesGuide](https://github.com/UweTrottmann/SeriesGuide). Small.
4. More widget sizes (watchlist grid). [Showly](https://github.com/michaldrabik/showly-2) style. Small.
5. Household profiles. [Tivi](https://github.com/chrisbanes/tivi). Medium.
6. SIMKL as a second tracker. [Moviebase](https://github.com/MoviebaseApp/Moviebase) tracks several services. Medium.
7. Android TV layout. [Tivi](https://github.com/chrisbanes/tivi), [react-native-tvos](https://github.com/react-native-tvos/react-native-tvos). Large.
8. Tautulli stats for a Plex server the viewer owns. LunaSea. Small to medium.

Not recommended: Prowlarr, Jackett, qBittorrent, SABnzbd, generic IPTV, or Stremio/Torrentio source lists. Those are indexers, download clients, or unlicensed streams.
