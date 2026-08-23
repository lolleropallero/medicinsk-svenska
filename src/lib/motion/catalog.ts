import type { MotionEffect } from './types';

export const MOTION_CATALOG: Record<MotionEffect, { duration: number; decorative: boolean }> = {
  'ui-tap': { duration: 90, decorative: false },
  reveal: { duration: 200, decorative: false },
  correct: { duration: 150, decorative: false },
  incorrect: { duration: 140, decorative: false },
  'item-change': { duration: 210, decorative: false },
  'overlay-open': { duration: 320, decorative: true },
  'overlay-close': { duration: 160, decorative: true },
  'quest-complete': { duration: 300, decorative: true },
  achievement: { duration: 500, decorative: true },
  'level-up': { duration: 520, decorative: true },
  'reward-reveal': { duration: 440, decorative: true },
  'hud-increment': { duration: 180, decorative: true },
  'daily-attention': { duration: 460, decorative: true },
  'season-unlock': { duration: 420, decorative: true },
  'league-promotion': { duration: 480, decorative: true },
};
