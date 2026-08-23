import { loadUiPreferences, saveUiPreferences } from '../progress/ui-preferences';
import type { SoundSettings } from './types';

export const DEFAULT_SOUND_SETTINGS:SoundSettings={enabled:true,volume:.65};
export function loadSoundSettings():SoundSettings { const value=loadUiPreferences();return{enabled:value.soundEnabled,volume:value.soundVolume}; }
export function saveSoundSettings(settings:SoundSettings){const current=loadUiPreferences();return saveUiPreferences({...current,soundEnabled:settings.enabled,soundVolume:Math.min(1,Math.max(0,settings.volume))});}
