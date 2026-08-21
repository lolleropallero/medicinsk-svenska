export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/u;
const pad = (value: number) => String(value).padStart(2, '0');

export function localDayKey(value: Date | number = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid date');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function dateFromDayKey(key: string): Date | null {
  if (!DAY_RE.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year!, month! - 1, day!);
  return date.getFullYear() === year && date.getMonth() === month! - 1 && date.getDate() === day ? date : null;
}
export function addLocalDays(key: string, amount: number): string | null {
  const date = dateFromDayKey(key); if (!date || !Number.isInteger(amount)) return null;
  date.setDate(date.getDate() + amount); return localDayKey(date);
}
export function daysBetween(from: string, to: string): number | null {
  const a = dateFromDayKey(from); const b = dateFromDayKey(to); if (!a || !b) return null;
  const au = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bu = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bu - au) / 86_400_000);
}
export function localWeekKey(value: Date | number = new Date()): string {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid date');
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday);
  return localDayKey(date);
}
export function localMidnight(value: Date | number = new Date()): number {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0); return date.getTime();
}
export function msUntilLocalMidnight(now = Date.now()): number {
  const next = new Date(now); next.setHours(24, 0, 0, 0); return Math.max(0, next.getTime() - now);
}
export const SEASON_EPOCH = '2026-08-17';
export function seasonInfo(value: Date | number = new Date()) {
  const day = localDayKey(value); const distance = daysBetween(SEASON_EPOCH, day);
  if (distance === null) throw new RangeError('Invalid season date');
  const index = Math.floor(distance / 28);
  const start = addLocalDays(SEASON_EPOCH, index * 28)!;
  const end = addLocalDays(start, 27)!;
  return { index, id: `kausi-${index}`, start, end, dayNumber: distance - index * 28 + 1 };
}
