# CineLog 1.0.36

Playlist requests were sent with a browser user agent. Many panels answer that with HTTP 403. Film and series stream code was not modified. No playlist is bundled.

## IPTV add

M3U URLs and Xtream `player_api.php` are loaded with GET and follow redirects. The default player name is `VLC/3.0.21 LibVLC/3.0.21`. It can be changed on the IPTV tab and in Settings under Live TV and IPTV. Playback of a viewer playlist uses the same name.

A refused request shows the HTTP status and the server’s own message, for example `HTTP 403: 403 Forbidden`. The request URL is not included, because an Xtream URL contains the password.

A directory on the server URL is kept, so `http://host:8080/portal` calls `/portal/player_api.php`. A pasted `get.php` address is sent to `player_api.php` in that same directory.
