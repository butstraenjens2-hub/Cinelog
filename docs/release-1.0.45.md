# CineLog 1.0.45

CineLog keeps playback and title information. Sync, server admin, request management, and stats integrations are gone. Film and series stream code was not modified.

## Removed

- **Trakt.** Watchlist and watched-progress sync, including the automatic background push. The local watchlist, named lists, and episode reminders stay on the device.
- **SIMKL.** Watchlist, ratings, and history sync. It did not play media or add title information on a movie or series page.
- **Sonarr.** The series-page “Add to Sonarr” action and the Sonarr settings screen. That sent a title to the viewer’s server. It did not show Sonarr metadata or play a file.
- **Radarr.** The movie-page “Add to Radarr” action and the Radarr settings screen. Same role as Sonarr, for movies.
- **Overseerr and Seerr.** The “Request” button on movie and series pages. It created a request on the viewer’s server and did not add title information or playback.
- **Tautulli.** Activity, home stats, history, and stopping a session. Stats and server admin only.
- **Screens and stored fields.** Their settings buttons, stack screens, and background sync are gone. Old keys in `cinelog.integrations.v1` and the device keystore are left in place and are not read.

## Kept

TMDB, the watchlist, named lists, followed actors and studios, the airing schedule, episode reminders, trailers, and Jellyfin and Emby. Jellyfin and Emby still play a file from that server inside the app.

## APKs

`assembleRelease` writes three APKs, all versionName `1.0.45` and versionCode `10045`:

- `cinelog-v1.0.45-universal.apk` — arm64-v8a and armeabi-v7a
- `cinelog-v1.0.45-arm64-v8a.apk`
- `cinelog-v1.0.45-armeabi-v7a.apk`

They install over 1.0.44. Native libraries stay compressed.
