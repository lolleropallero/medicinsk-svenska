import { playSound } from '../sound/player';
import type { SoundEffect } from '../sound/types';
import { MOTION_CATALOG } from './catalog';
import { currentMotionMode } from './preferences';
import type { FeedbackRequest, MotionEffect } from './types';

const soundEffects = new Set<MotionEffect>(['ui-tap','reveal','correct','incorrect','overlay-open','overlay-close','quest-complete','achievement','level-up','reward-reveal']);
const cleanup = new WeakMap<HTMLElement, number>();

export function requestFeedback(effect: MotionEffect, target?: HTMLElement | null, sound: SoundEffect | null = soundEffects.has(effect) ? effect as SoundEffect : null): FeedbackRequest {
  const detail: FeedbackRequest = { effect, mode: currentMotionMode(), sound };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app-feedback', { detail }));
    if (target) {
      const prior = cleanup.get(target);
      if (prior) window.clearTimeout(prior);
      delete target.dataset.motionState;
      // Force only the animation name to restart; application state never depends on this frame.
      void target.offsetWidth;
      target.dataset.motionState = effect;
      target.dataset.motionMode = detail.mode;
      cleanup.set(target, window.setTimeout(() => {
        if (target.dataset.motionState === effect) delete target.dataset.motionState;
        cleanup.delete(target);
      }, detail.mode === 'reduced' ? 80 : Math.max(900, MOTION_CATALOG[effect].duration + 40)));
    }
  }
  if (sound) playSound(sound);
  return detail;
}

declare global { interface WindowEventMap { 'app-feedback': CustomEvent<FeedbackRequest> } }
