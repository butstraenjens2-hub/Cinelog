/**
 * URL helpers for a viewer's own Sonarr or Radarr server.
 * The *arr apps expose a public REST API; this file only builds request URLs.
 */

export function normalizeServerUrl(input) {
  const trimmed = String(input ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw Object.assign(new Error("Server URL is required."), { status: 0 });
  }
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw Object.assign(
      new Error("Enter a full URL, including http:// or https://."),
      { status: 0 },
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw Object.assign(new Error("Only http and https URLs are supported."), {
      status: 0,
    });
  }
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path && path !== "/" ? path : ""}`;
}

export function joinApi(base, path) {
  const root = normalizeServerUrl(base);
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${root}${suffix}`;
}

/**
 * Body for POST /api/v3/series. `lookup` is the resource Sonarr returned from
 * /series/lookup. Searching the viewer's indexers stays off unless they opt in.
 */
export function seriesAddBody(lookup, options) {
  const source = lookup && typeof lookup === "object" ? lookup : {};
  const { id, ...rest } = source;
  const body = {
    ...rest,
    qualityProfileId: options.qualityProfileId,
    rootFolderPath: options.rootFolderPath,
    monitored: options.monitored !== false,
    seasonFolder: true,
    addOptions: {
      monitor: options.monitor || "all",
      searchForMissingEpisodes: options.searchForMissingEpisodes === true,
    },
  };
  if (id) body.id = id;
  return body;
}

/** Body for POST /api/v3/movie. Movie search stays off unless the viewer opts in. */
export function movieAddBody(lookup, options) {
  const source = lookup && typeof lookup === "object" ? lookup : {};
  const { id, ...rest } = source;
  const body = {
    ...rest,
    qualityProfileId: options.qualityProfileId,
    rootFolderPath: options.rootFolderPath,
    monitored: options.monitored !== false,
    addOptions: {
      searchForMovie: options.searchForMovie === true,
    },
  };
  if (id) body.id = id;
  return body;
}
