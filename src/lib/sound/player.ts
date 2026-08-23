import { CALM_ALLOWED, effectiveVolume, SOUND_CATALOG } from './catalog';
import { loadSoundSettings } from './settings';
import type { SoundEffect } from './types';

let unlocked=false,current:HTMLAudioElement|null=null,currentEffect:SoundEffect|null=null;
const cache=new Map<SoundEffect,HTMLAudioElement>(),lastPlayed=new Map<SoundEffect,number>();
const priority:Record<SoundEffect,number>={'ui-tap':0,reveal:2,correct:3,incorrect:3,'overlay-open':1,'overlay-close':1,'quest-complete':4,achievement:5,'level-up':6,'reward-reveal':5};

export function unlockSound(){unlocked=true;}
export function resetSoundPlayerForTests(){unlocked=false;current=null;currentEffect=null;cache.clear();lastPlayed.clear();}
export function canPlaySound(effect:SoundEffect,options:{hidden?:boolean;calm?:boolean;settings?:ReturnType<typeof loadSoundSettings>}={}):boolean{
  const settings=options.settings??loadSoundSettings();
  return unlocked&&!options.hidden&&settings.enabled&&settings.volume>0&&(!options.calm||CALM_ALLOWED.has(effect));
}
export function playSound(effect:SoundEffect):boolean{
  if(typeof window==='undefined'||typeof document==='undefined')return false;
  const hidden=typeof document!=='undefined'&&document.hidden,calm=typeof document!=='undefined'&&document.documentElement.dataset.calm==='true';
  const audible=canPlaySound(effect,{hidden,calm});
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('sound-effect-requested',{detail:{effect,audible}}));
  if(!audible)return false;
  const now=performance.now(),cooldown=effect==='ui-tap'?50:25;
  if(now-(lastPlayed.get(effect)??-Infinity)<cooldown)return false;
  if(current&&!current.paused&&currentEffect&&priority[effect]<priority[currentEffect])return false;
  if(current&&!current.paused){current.pause();current.currentTime=0;}
  const audio=cache.get(effect)??new Audio(SOUND_CATALOG[effect]);cache.set(effect,audio);
  audio.volume=effectiveVolume(loadSoundSettings().volume,effect);audio.currentTime=0;current=audio;currentEffect=effect;lastPlayed.set(effect,now);
  void audio.play().catch(()=>{});return true;
}
export function playMilestone(input:{levelUp?:boolean;achievement?:boolean;questComplete?:boolean}){
  const effect=selectMilestone(input);
  return effect?playSound(effect):false;
}
export function selectMilestone(input:{levelUp?:boolean;achievement?:boolean;questComplete?:boolean}):SoundEffect|null{return input.levelUp?'level-up':input.achievement?'achievement':input.questComplete?'quest-complete':null;}
if(typeof window!=='undefined'){
  const unlock=()=>unlockSound();
  window.addEventListener('pointerdown',unlock,{capture:true,once:true});
  window.addEventListener('keydown',unlock,{capture:true,once:true});
}

declare global { interface WindowEventMap { 'sound-effect-requested':CustomEvent<{effect:SoundEffect;audible:boolean}> } }
