# CineLog 1.0.43

Follow actors and studios, keep named lists, and see which followed shows air today or this week. No stream sources were added, and the film and series stream code was not changed.

## Added

- **Followed actors, studios, and networks.** A person page has a Follow button. A movie’s studios and a series’ networks open a page with Follow and that company’s newest and upcoming catalogue titles. The Followed screen (Gevolgd) lists everyone you follow. Follows stay on the device. Studio and network links need the catalogue to send their ids; this release’s API does. A catalogue host that has not been updated still follows actors, and shows studio names only when the ids are missing.
- **Named lists.** Create lists apart from the watchlist, add a title from its page, and share through the Android share sheet. The text includes a `cinelog://list/…` link and TMDB links. Paste that text, or open the link, to import the list on another device. Lists stay on the device.
- **Airing schedule.** Shows on your watchlist or in your history are grouped into airing today and the rest of this week, from TMDB’s next episode date.

## Already present

- **Episode reminders.** Settings already schedules a local notification on the air date of the next episode of a followed show. This release does not add a second reminder.
- **Trakt.** Watchlist and watched history already push and pull, with optional automatic push, plus a pull of playback positions. Nothing was added.

## Skipped

- **Chromecast.** `react-native-google-cast` can build into a custom Expo app, but it would not play what CineLog plays. Trailers use YouTube’s embedded player, which the default Cast receiver cannot load. Jellyfin and IPTV playback go through Media3 or libVLC with playlist headers, and often MPEG-TS, which a Chromecast fetches on its own and cannot authenticate or play. The Cast SDK was not added.

## APKs

`assembleRelease` now writes three APKs, all versionName `1.0.43` and versionCode `10043`:

- `cinelog-v1.0.43-universal.apk` — arm64-v8a and armeabi-v7a
- `cinelog-v1.0.43-arm64-v8a.apk`
- `cinelog-v1.0.43-armeabi-v7a.apk`

They share one version code so 1.0.44 can still install over any of them. Native libraries stay compressed.
