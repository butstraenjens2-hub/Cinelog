# CineLog 1.0.44

CineLog is movies and series. Live TV, the IPTV tab, and external players are gone. Film and series stream code was not modified.

## Removed

- **Live TV tab.** The channel list, the built-in guide, and playback of the official broadcaster streams (France 24, DW, Al Jazeera, and the pages for NASA+ and NHK WORLD-JAPAN).
- **IPTV tab.** M3U URLs and files, Xtream logins, the Smarters-style home (live, movies, series, catch-up, favorites, account, guide), playlist diagnostics, per-playlist player choice, and the user-agent presets.
- **External players.** libVLC (`org.videolan.android:libvlc-all`), the IPTV Media3/ExoPlayer view, and the OkHttp client that downloaded playlists. Kodi is removed: the remote, “Play on Kodi”, and the library handoff. Kodi was only an external player.
- **Navigation and settings.** The Live TV and IPTV tabs, the Live TV and IPTV settings group, and the Kodi button. The top and bottom menus are Home, Movies, Series, Search, and Watchlist.
- **Stored data.** This version does not read `cinelog.iptv.v1`, IPTV passwords or pins, or the Kodi URL, username, and password. Those old values stay on the device and are ignored. Other saved data is unchanged.

## Kept

TMDB, the watchlist, named lists, followed actors and studios, the airing schedule, Trakt, SIMKL, Sonarr, Radarr, Jellyfin and Emby, Overseerr and Seerr, Tautulli, and trailers. Jellyfin and Emby still play a file from that server inside the app.

## APKs

`assembleRelease` writes three APKs, all versionName `1.0.44` and versionCode `10044`:

- `cinelog-v1.0.44-universal.apk` — arm64-v8a and armeabi-v7a
- `cinelog-v1.0.44-arm64-v8a.apk`
- `cinelog-v1.0.44-armeabi-v7a.apk`

They install over 1.0.43. Native libraries stay compressed. libVLC is no longer in the APK.
