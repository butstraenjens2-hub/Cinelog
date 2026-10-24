export function movieAddBody(
  lookup: Record<string, unknown>,
  options: {
    qualityProfileId: number;
    rootFolderPath: string;
    monitored?: boolean;
    searchForMovie?: boolean;
  },
): Record<string, unknown>;
