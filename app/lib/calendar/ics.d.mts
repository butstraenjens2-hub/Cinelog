export function buildIcs(
  events: Array<{ uid?: string; title?: string; start?: string; description?: string }>,
  now?: Date,
): string;
