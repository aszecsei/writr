const DEFAULT_WPM = 200;

function formatMinutes(
  wordCount: number,
  wpm: number,
  compact: boolean,
): string {
  const minutes = Math.ceil(wordCount / wpm);
  if (minutes < 1) return compact ? "<1m" : "< 1 min";
  if (minutes < 60) return compact ? `${minutes}m` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (!remaining) return `${hours}h`;
  return compact ? `${hours}h${remaining}m` : `${hours}h ${remaining}m`;
}

export function formatReadingTime(
  wordCount: number,
  wpm = DEFAULT_WPM,
): string {
  return formatMinutes(wordCount, wpm, false);
}

export function formatReadingTimeCompact(
  wordCount: number,
  wpm = DEFAULT_WPM,
): string {
  return formatMinutes(wordCount, wpm, true);
}
