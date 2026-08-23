import { MOTION_CATALOG } from './catalog';
import type { MotionEffect, MotionMode } from './types';

export function motionMode(options: { calm?: boolean; reduced?: boolean } = {}): MotionMode {
  if (options.reduced) return 'reduced';
  return options.calm ? 'calm' : 'full';
}

export function currentMotionMode(): MotionMode {
  if (typeof window === 'undefined') return 'full';
  return motionMode({
    calm: document.documentElement.dataset.calm === 'true',
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
}

export function allowsSpatialMotion(effect: MotionEffect, mode: MotionMode): boolean {
  if (mode === 'reduced') return false;
  return mode !== 'calm' || !MOTION_CATALOG[effect].decorative;
}
