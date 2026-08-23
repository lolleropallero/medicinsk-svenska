import uiTapUrl from '../../assets/audio/ui-tap.ogg?url';
import revealUrl from '../../assets/audio/reveal.ogg?url';
import correctUrl from '../../assets/audio/correct.ogg?url';
import incorrectUrl from '../../assets/audio/incorrect.ogg?url';
import overlayOpenUrl from '../../assets/audio/overlay-open.ogg?url';
import overlayCloseUrl from '../../assets/audio/overlay-close.ogg?url';
import milestoneUrl from '../../assets/audio/milestone.ogg?url';
import rewardRevealUrl from '../../assets/audio/reward-reveal.ogg?url';
import type { SoundEffect } from './types';

export const SOUND_EFFECTS = ['ui-tap','reveal','correct','incorrect','overlay-open','overlay-close','quest-complete','achievement','level-up','reward-reveal'] as const satisfies readonly SoundEffect[];
export const SOUND_GAINS: Record<SoundEffect, number> = {
  'ui-tap':.45,reveal:.55,correct:.70,incorrect:.45,'overlay-open':.45,'overlay-close':.40,
  'quest-complete':.80,achievement:.90,'level-up':.95,'reward-reveal':.85,
};
export const SOUND_CATALOG: Record<SoundEffect, string> = {
  'ui-tap':uiTapUrl,reveal:revealUrl,correct:correctUrl,incorrect:incorrectUrl,
  'overlay-open':overlayOpenUrl,'overlay-close':overlayCloseUrl,'quest-complete':milestoneUrl,
  achievement:milestoneUrl,'level-up':milestoneUrl,'reward-reveal':rewardRevealUrl,
};
export const AUDIO_FILENAMES = ['ui-tap.ogg','reveal.ogg','correct.ogg','incorrect.ogg','overlay-open.ogg','overlay-close.ogg','milestone.ogg','reward-reveal.ogg'] as const;
export const CALM_ALLOWED = new Set<SoundEffect>(['reveal','correct','incorrect']);
export const effectiveVolume = (master:number,effect:SoundEffect) => Math.min(1,Math.max(0,master))*SOUND_GAINS[effect];
