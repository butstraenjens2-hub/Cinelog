# CineLog 1.0.46

Radarr is back, and only Radarr. Movie and series stream code was not modified.

## Radarr

- **Settings.** A Radarr URL and an API key. The key is stored in the device keystore. Test connection talks to that server and shows the instance name.
- **Movie pages.** When Radarr is connected, the page says whether that TMDB movie is already in the library, and whether the file is on disk. If it is not in the library, Add to Radarr asks for a quality profile and a root folder. Searching the server’s indexers stays off unless you turn that option on.
- **Stored data.** A Radarr URL saved by an older version is read again. The same keystore name is used for the API key. Sonarr, Trakt, SIMKL, Overseerr, Seerr, and Tautulli stay unread.

Jellyfin and Emby still play a file from that server inside the app. TMDB, the watchlist, named lists, follows, the airing schedule, episode reminders, and trailers stay.

## APKs

`assembleRelease` writes three APKs, all versionName `1.0.46` and versionCode `10046`:

- `cinelog-v1.0.46-universal.apk` — arm64-v8a and armeabi-v7a
- `cinelog-v1.0.46-arm64-v8a.apk`
- `cinelog-v1.0.46-armeabi-v7a.apk`

They install over 1.0.45. Native libraries stay compressed.
