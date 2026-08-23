import { describe, expect, it } from 'vitest';
import { MOTION_CATALOG } from '../../src/lib/motion/catalog';
import { allowsSpatialMotion, motionMode } from '../../src/lib/motion/preferences';

describe('motion preferences', () => {
  it('keeps functional learning motion in calm mode and suppresses decoration', () => {
    expect(allowsSpatialMotion('reveal', 'calm')).toBe(true);
    expect(allowsSpatialMotion('incorrect', 'calm')).toBe(true);
    expect(allowsSpatialMotion('achievement', 'calm')).toBe(false);
    expect(allowsSpatialMotion('daily-attention', 'calm')).toBe(false);
  });

  it('uses non-spatial feedback for every effect in reduced mode', () => {
    expect(motionMode({ reduced: true, calm: false })).toBe('reduced');
    for (const effect of Object.keys(MOTION_CATALOG) as (keyof typeof MOTION_CATALOG)[])
      expect(allowsSpatialMotion(effect, 'reduced')).toBe(false);
  });

  it('keeps all ordinary durations below the motion-system ceiling', () => {
    expect(Math.max(...Object.values(MOTION_CATALOG).map((entry) => entry.duration))).toBeLessThanOrEqual(700);
  });
});
