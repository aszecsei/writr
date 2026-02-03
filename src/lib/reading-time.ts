const DEFAULT_WPM = 200;

export function formatReadingTime(
  wordCount: number,
  wpm = DEFAULT_WPM,
): string {
  const minutes = Math.ceil(wordCount / wpm);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function formatReadingTimeCompact(
  wordCount: number,
  wpm = DEFAULT_WPM,
): string {
  const minutes = Math.ceil(wordCount / wpm);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h${remaining}m` : `${hours}h`;
}
