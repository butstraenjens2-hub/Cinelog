/**
 * Current and next programme for one channel.
 * `offsetHours` shifts the guide clock (EPG timeshift) without changing
 * the stored timestamps.
 */

export function currentAndNext(programmes, channelId, now, offsetHours = 0) {
  const shift = (Number(offsetHours) || 0) * 60 * 60 * 1000;
  const clock = Number(now) || 0;
  const rows = (Array.isArray(programmes) ? programmes : [])
    .filter((programme) => programme && programme.channelId === channelId)
    .map((programme) => ({
      ...programme,
      startMs: Number(programme.startMs) + shift,
      stopMs: Number(programme.stopMs) + shift,
    }))
    .sort((left, right) => left.startMs - right.startMs);
  const current = rows.find((programme) => programme.startMs <= clock && programme.stopMs > clock) || null;
  const next = rows.find((programme) => programme.startMs >= (current ? current.stopMs : clock)) || null;
  return { current, next };
}
