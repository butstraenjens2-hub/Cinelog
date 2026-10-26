# CineLog 1.0.40

IPTV now opens like a playlist app the viewer already knows, with CineLog’s own layout. A saved playlist shows its name, type, and Xtream status when the server reports one. Adding a playlist starts by choosing Xtream or an M3U URL/file, then checks the account or the channel counts. The open playlist has tiles for Live TV, Movies, Series, catch-up, favorites, recently watched, account, and per-playlist settings.

## Empty Live list

Opening a playlist shows a spinner and the download size, then “Parsing N channels”, with Cancel and Retry. A body that parses to nothing says why: HTTP status, content type, and a short preview such as an HTML login page, an empty body, gzip binary, or a file that is not `#EXTM3U`. Show details lists the same facts without the playlist address.

The parser keeps `m3u_plus` attributes (`tvg-id`, `tvg-name`, `tvg-logo`, `group-title`, including single quotes), a leading BOM, and CR, LF, or CRLF lines. On Android a gzip body is inflated before parsing even when the request did not ask for gzip. Large playlists are still written to a file and read line by line. Section tabs show the last update and the counts, for example Live 1234 and Movies 5678, including when Live is empty because every row is under `/movie/` or `/series/`.

## Playback

The 1.0.39 fetch and Media3 player are unchanged in shape. Resume stores a position per title. Each playlist keeps its own player, user agent, MPEG-TS or HLS choice, guide timeshift, and category lock. Film and series stream code was not modified. No playlist is bundled. No GPL code was copied.

Playback uses AndroidX Media3 1.8.0 (Apache-2.0). The playlist client uses OkHttp 4.9.2 (Apache-2.0). libVLC was not added.
