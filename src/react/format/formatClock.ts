/** `31.4` under a minute, `1:05.0` above it. Always one decimal, so digits never jump. */
export function formatClock(ms: number): string {
  const safe = Math.max(0, ms);
  const tenths = Math.ceil(safe / 100);
  const whole = Math.floor(tenths / 10);
  const decimal = tenths % 10;

  if (whole < 60) return `${whole}.${decimal}`;

  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${decimal}`;
}

/** Whole seconds, for compact summaries where a decimal is noise. */
export function formatSeconds(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}
