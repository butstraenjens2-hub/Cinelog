# CineLog 1.0.42

CineLog now includes a privacy policy. The developer is a private individual in Belgium, so the GDPR applies. The notice is in Dutch and English.

`PRIVACY.md` at the repository root and `docs/privacy.html` carry the same text. The HTML file is a single page with no cookies and no analytics script, so it can be published with GitHub Pages. Settings has a Privacy policy entry that opens the same text inside the app, which works offline, and a link to the copy on GitHub.

The policy matches the app as of this release. The library, settings, IPTV playlists, and API keys for Sonarr, Radarr, Jellyfin or Emby, Overseerr or Seerr, Tautulli, Kodi, SIMKL, and Trakt stay on the device. Secrets go in the device keystore. The app does not show ads, does not sell data, and does not start an analytics or crash-reporting SDK. A build without a TMDB key asks a developer-run catalogue proxy, and on launch the app can ask Expo whether an update is published. Those contacts are described in the policy. Film and series stream code was not modified.

Clearing the app’s storage, or uninstalling it, removes the local data. Questions go to the GitHub issues for this repository. The policy is effective on 23 October 2026.
