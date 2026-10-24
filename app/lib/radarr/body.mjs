/**
 * Body for POST /api/v3/movie.
 * Searching the viewer's indexers stays off unless they opt in.
 */

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
