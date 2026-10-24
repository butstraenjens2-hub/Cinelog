# CineLog 1.0.37

A playlist that still answered `HTTP 403: 403 Forbidden` with the VLC player name now says which request failed. Film and series stream code was not modified. No playlist is bundled.

## Which request failed

Xtream sign-in, live categories, live streams, movie categories, movies, series categories, series, the guide, and an M3U download each name themselves. A refusal looks like `Live categories: HTTP 403: 403 Forbidden`. A movie list that fails does not hide channels that already loaded. The request URL is still omitted, because an Xtream URL contains the password.

Playlist requests send only a player `User-Agent` and an `Accept` header. Referer and Origin are not sent. The same player name is used for the catalogue, the guide, logos, and playback of a playlist you added.

## Player names and a connection test

The IPTV sheet and Settings offer VLC, IPTV Smarters (`IPTVSmartersPlayer`), TiviMate, okhttp, and a custom name. The default stays VLC. Test connection checks sign-in and live categories, and if sign-in fails it tries the other of http or https once and tells you which address answered.

## IPTV screen and phone navigation

The playlist sits in a header card. Add M3U, import, Xtream, and the player name live in an Add / manage playlists sheet. Live, Movies, Series, and Favorites are a segmented control, with category chips and a logo grid.

The phone bar shows an icon on every tab and a short label only on the active tab, so labels are no longer cut off.
