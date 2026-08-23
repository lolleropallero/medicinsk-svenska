import type { SoundEffect } from '../sound/types';

export type MotionEffect = SoundEffect | 'item-change' | 'hud-increment' | 'daily-attention' | 'season-unlock' | 'league-promotion';
export type MotionMode = 'full' | 'calm' | 'reduced';

export interface FeedbackRequest {
  effect: MotionEffect;
  mode: MotionMode;
  sound: SoundEffect | null;
}
