import { loadUiPreferences, saveUiPreferences } from '../progress/ui-preferences';
import type { MusicSettings } from './types';

export const DEFAULT_MUSIC_SETTINGS:MusicSettings={enabled:true,volume:.20};
export function loadMusicSettings():MusicSettings { const value=loadUiPreferences();return{enabled:value.musicEnabled,volume:value.musicVolume}; }
export function saveMusicSettings(settings:MusicSettings){
  const current=loadUiPreferences(),next={enabled:Boolean(settings.enabled),volume:Math.min(1,Math.max(0,Number.isFinite(settings.volume)?settings.volume:.20))};
  saveUiPreferences({...current,musicEnabled:next.enabled,musicVolume:next.volume});
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('music-settings-changed',{detail:next}));
  return next;
}

declare global { interface WindowEventMap { 'music-settings-changed':CustomEvent<MusicSettings> } }
