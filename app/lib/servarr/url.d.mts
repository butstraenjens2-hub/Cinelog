export function normalizeServerUrl(input: string): string;
export function joinApi(base: string, path: string): string;

export function seriesAddBody(
  lookup: Record<string, unknown>,
  options: {
    qualityProfileId: number;
    rootFolderPath: string;
    monitored?: boolean;
    monitor?: string;
    searchForMissingEpisodes?: boolean;
  },
): Record<string, unknown>;

export function movieAddBody(
  lookup: Record<string, unknown>,
  options: {
    qualityProfileId: number;
    rootFolderPath: string;
    monitored?: boolean;
    searchForMovie?: boolean;
  },
): Record<string, unknown>;
