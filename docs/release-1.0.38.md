# CineLog 1.0.38

A plain-HTTP `get.php` playlist that played in VLC on the same phone was refused with HTTP 403. The user agent was already the VLC name. Film and series stream code was not modified. No playlist is bundled.

## Root cause

React Native sends playlist requests through OkHttp 4.9.2. That client keeps a caller `User-Agent`. It also adds `Accept-Encoding: gzip` when the request has neither `Accept-Encoding` nor `Range`, and it adds `Connection: Keep-Alive`. It does not add `Accept-Language`, and playlist fetches do not send cookies.

1.0.37 therefore left the phone as:

- `User-Agent: VLC/3.0.21 LibVLC/3.0.21`
- `Accept: application/json, application/vnd.apple.mpegurl, */*`
- `Accept-Encoding: gzip`
- `Connection: Keep-Alive`

VLC sends `User-Agent`, `Accept: */*`, `Range: bytes=0-`, and `Icy-MetaData: 1`, with no gzip, no `Accept-Language`, and no cookies. The extra gzip header and the different Accept value are what the panel rejected. The player name was not replaced, the query string was not rewritten, cleartext HTTP was not upgraded, and a redirect kept the same headers.

## What 1.0.38 sends

Playlist downloads now ask for the VLC header set. Because `Range` is set, OkHttp does not add gzip. The only header the stack still adds is `Connection: Keep-Alive`.

Test connection prints those request headers and the response headers. Values that would repeat the playlist address are hidden. The report also says whether the scheme stayed http or https.
