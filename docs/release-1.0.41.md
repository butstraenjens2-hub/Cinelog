# CineLog 1.0.41

A playlist address that works in VLC and in an Xtream client can still fail in the OkHttp download. 1.0.41 tries two more readers before it shows an error, and it can copy a sanitized report of what happened.

## How a playlist is loaded

1. OkHttp runs first, with the same client as 1.0.40: the VLC user agent, `Accept: */*`, `Range: bytes=0-`, and no `Accept-Encoding`. A gzip body is still inflated when the server sends one.
2. If that request throws, or the file parses to zero items, libVLC opens the same address. It parses with the network flag and reads the playlist items from `Media.subItems`. That is the same kind of open VLC uses for a `get.php` URL.
3. If libVLC is unavailable or also returns nothing, and the address is a `get.php` URL with `username` and `password`, CineLog derives the server, user, and password and calls `player_api.php`: sign-in, `get_live_categories`, `get_live_streams`, `get_vod_streams`, and `get_series`. A file address without those fields skips this step.

Cancel stops the chain. A download that already returned items does not call the later steps. The banner names the step while libVLC or the API is running. A successful fallback says which one loaded the list.

## Copy diagnostics

Copy diagnostics puts a short report on the clipboard: which step ran, the HTTP status, content type, byte count, response headers, and about the first 200 characters of the body. The playlist address and any password are removed before the copy.

## Playback

IPTV still starts in Media3. If Media3 reports an error, the same stream continues in libVLC. Each playlist can choose libVLC, Media3, or the Expo player. The Expo player stays on that player. Resume, user agent, and stream format are unchanged.

libVLC is `org.videolan.android:libvlc-all` 3.6.5, LGPL-2.1, linked from the published Android archive. The APK still contains arm64-v8a and armeabi-v7a only. Native libraries are compressed in that APK so both ABIs and libVLC fit in one release file. Media3 1.8.0 and OkHttp 4.9.2 remain Apache-2.0. No GPL application source was copied. Film and series stream code was not modified. No playlist is bundled.
