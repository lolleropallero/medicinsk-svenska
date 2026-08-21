export type DurationRounding = 'floor' | 'ceil';

export function formatDuration(milliseconds: number, rounding: DurationRounding = 'floor'): string {
  const safeMilliseconds = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
  const seconds = rounding === 'ceil'
    ? Math.ceil(safeMilliseconds / 1000)
    : Math.floor(safeMilliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(remainder).padStart(2, '0');

  return hours > 0
    ? `${hours}:${paddedMinutes}:${paddedSeconds}`
    : `${paddedMinutes}:${paddedSeconds}`;
}
