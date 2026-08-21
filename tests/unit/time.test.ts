import { describe, expect, it } from 'vitest';
import { formatDuration } from '../../src/lib/time';

describe('duration formatting', () => {
  it.each([
    [0, '00:00'],
    [999, '00:00'],
    [5_000, '00:05'],
    [(9 * 60 + 7) * 1000, '09:07'],
    [(59 * 60 + 59) * 1000, '59:59'],
    [60 * 60 * 1000, '1:00:00'],
    [(60 * 60 + 2 * 60 + 3) * 1000, '1:02:03'],
    [12 * 60 * 60 * 1000, '12:00:00'],
  ] as const)('formats %i ms as %s', (milliseconds, expected) => {
    expect(formatDuration(milliseconds)).toBe(expected);
  });

  it('rounds elapsed time down', () => {
    expect(formatDuration(5_999)).toBe('00:05');
  });

  it('rounds countdown time up', () => {
    expect(formatDuration(5_001, 'ceil')).toBe('00:06');
  });

  it('clamps negative countdowns to zero', () => {
    expect(formatDuration(-1, 'ceil')).toBe('00:00');
  });
});
