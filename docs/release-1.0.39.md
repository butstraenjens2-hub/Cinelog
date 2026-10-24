# CineLog 1.0.39

Playlist loading and playback for a viewer’s own Xtream or M3U link now follow the same request shape as VLC, and playback uses Media3. Film and series stream code was not modified. No playlist is bundled. No GPL code was copied.

## Libraries

Playback uses AndroidX Media3 1.8.0 (Apache-2.0): ExoPlayer, HLS, and the OkHttp data source. That is the same Media3 line expo-video already ships. The IPTV client uses OkHttp 4.9.2 (Apache-2.0), which React Native already includes. libVLC was not added. A player setting chooses Media3 or the existing Expo player.

## Fetch

On Android, playlist and Xtream API calls go through a small native client. It sends `User-Agent`, `Accept: */*`, `Icy-MetaData: 1`, and `Range: bytes=0-` when the request does not already have a range. It removes `Accept-Encoding`, so OkHttp does not turn on transparent gzip. Cookies, `Accept-Language`, Referer, and Origin are not sent. Redirects stay on that client, including http to https, and the connection report says whether the scheme changed. The response is written to a file and an M3U is parsed line by line, so a large `m3u_plus` file is not held as one string.

## Playback

Live URLs built from Xtream default to `http://host/live/user/pass/id.ts`. `.m3u8`, `/movie/`, and `/series/` are unchanged when the server names those extensions. Media3 opens HLS with `HlsMediaSource` and MPEG-TS, MP4, and MKV with `ProgressiveMediaSource`. The same header client is attached, cleartext HTTP is allowed in the network security config, and a refused stream shows `Playback: HTTP 403` without the address.
