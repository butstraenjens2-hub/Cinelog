# CineLog 1.0.34

The nine follow-ups from 1.0.33. Stream-embed code was not modified. No indexer, download client, or unlicensed playlist was added.

## What landed

1. **Jellyfin / Emby.** The viewer signs in, or pastes an API key, on their own server. CineLog lists movies and episodes and direct-plays a file with the token in a header. Emby uses the same MediaBrowser API.
2. **Seerr / Overseerr.** URL plus API key. Movie and series pages can request that TMDB id. The request runs on the viewer's server.
3. **ICS export.** Upcoming episodes of followed shows are shared as an `.ics` file.
4. **Widget sizes.** The up-next widget can be small or resized. A second widget lists four watchlist titles.
5. **Household profiles.** Named profiles on this device, each with its own watchlist and progress. Switching snapshots the library locally.
6. **SIMKL.** The viewer's own client id, AUTH v2 device code, then pull and push of watchlist and watched progress when a TMDB id is present.
7. **Android TV.** The app is a Leanback launcher target. On a TV device the layout uses the top navigation, larger posters, and a focus ring. It is still the same React Native app.
8. **Tautulli.** Read-only activity, home stats, and recent plays from the viewer's server.
9. **Kodi.** JSON-RPC remote: ping, now playing, d-pad, play/pause, and stop. It does not install add-ons.

## Scoped down

- Jellyfin/Emby has no SyncPlay, downloads, or Live TV tuner. Series open their episodes; playback is a static direct stream.
- Seerr requests the movie or the whole series. There is no quality-profile picker.
- The calendar is one-way and only includes episodes CineLog already tracks.
- Widgets are text, not poster grids. RemoteViews does not load remote images here.
- Profiles are local. They are not separate accounts and they do not sync to the cloud.
- SIMKL does not sync ratings. Shows marked only as "watching" without episode rows are not ticked episode by episode.
- Android TV is a 10-foot layout of this app, not a separate Leanback activity.
- Tautulli cannot stop a stream.
- The Kodi screen does not browse the library or install add-ons.
