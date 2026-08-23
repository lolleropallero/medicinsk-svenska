export type SoundEffect =
  | 'ui-tap'
  | 'reveal'
  | 'correct'
  | 'incorrect'
  | 'overlay-open'
  | 'overlay-close'
  | 'quest-complete'
  | 'achievement'
  | 'level-up'
  | 'reward-reveal';

export interface SoundSettings { enabled: boolean; volume: number }
