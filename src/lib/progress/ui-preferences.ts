import { localDayKey } from './calendar';

export const UI_PREFERENCES_KEY = 'medicinsk-svenska.ui.v1';
export const UI_PREFERENCES_SCHEMA_VERSION = 1 as const;

export interface UiPreferencesV1 {
  schemaVersion: typeof UI_PREFERENCES_SCHEMA_VERSION;
  dailyOverlayDismissedDay?: string;
  soundEnabled: boolean;
  soundVolume: number;
  musicEnabled: boolean;
  musicVolume: number;
}

export interface DailyOverlayEligibility {
  pathname: string;
  localDay: string;
  preferences: UiPreferencesV1;
  calmMode: boolean;
  dailyGoalComplete: boolean;
  dailyQuestsComplete: boolean;
  otherModalOpen: boolean;
}

export function defaultUiPreferences(): UiPreferencesV1 {
  return { schemaVersion: UI_PREFERENCES_SCHEMA_VERSION, soundEnabled: true, soundVolume: .65, musicEnabled:true, musicVolume:.20 };
}

export function parseUiPreferences(raw: string | null): UiPreferencesV1 {
  if (!raw) return defaultUiPreferences();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return defaultUiPreferences();
    const candidate = value as Partial<UiPreferencesV1>;
    if (candidate.schemaVersion !== UI_PREFERENCES_SCHEMA_VERSION) return defaultUiPreferences();
    if (candidate.dailyOverlayDismissedDay !== undefined &&
        !/^\d{4}-\d{2}-\d{2}$/.test(candidate.dailyOverlayDismissedDay)) return defaultUiPreferences();
    const soundEnabled=typeof candidate.soundEnabled==='boolean'?candidate.soundEnabled:true;
    const soundVolume=typeof candidate.soundVolume==='number'&&Number.isFinite(candidate.soundVolume)&&candidate.soundVolume>=0&&candidate.soundVolume<=1?candidate.soundVolume:.65;
    const musicEnabled=typeof candidate.musicEnabled==='boolean'?candidate.musicEnabled:true;
    const musicVolume=typeof candidate.musicVolume==='number'&&Number.isFinite(candidate.musicVolume)&&candidate.musicVolume>=0&&candidate.musicVolume<=1?candidate.musicVolume:.20;
    return { schemaVersion:UI_PREFERENCES_SCHEMA_VERSION,soundEnabled,soundVolume,musicEnabled,musicVolume,
      ...(candidate.dailyOverlayDismissedDay?{dailyOverlayDismissedDay:candidate.dailyOverlayDismissedDay}:{}) };
  } catch {
    return defaultUiPreferences();
  }
}

export function loadUiPreferences(storage: Pick<Storage, 'getItem'> = localStorage): UiPreferencesV1 {
  try{return parseUiPreferences(storage.getItem(UI_PREFERENCES_KEY));}catch{return defaultUiPreferences();}
}
export function saveUiPreferences(preferences:UiPreferencesV1,storage:Pick<Storage,'setItem'>=localStorage){try{storage.setItem(UI_PREFERENCES_KEY,JSON.stringify(preferences));}catch{/* presentation preferences remain usable in memory */}return preferences;}

export function markDailyOverlayHandled(
  storage: Pick<Storage, 'getItem'|'setItem'> = localStorage,
  date = new Date(),
): UiPreferencesV1 {
  const preferences: UiPreferencesV1 = {
    ...loadUiPreferences(storage),
    dailyOverlayDismissedDay: localDayKey(date),
  };
  storage.setItem(UI_PREFERENCES_KEY, JSON.stringify(preferences));
  return preferences;
}

export function dismissDailyOverlay(
  storage: Pick<Storage, 'getItem'|'setItem'> = localStorage,
  date = new Date(),
): UiPreferencesV1 {
  return markDailyOverlayHandled(storage, date);
}

export function shouldAutoOpenDailyOverlay(input: DailyOverlayEligibility): boolean {
  return input.pathname === '/' &&
    !input.calmMode &&
    !input.otherModalOpen &&
    (!input.dailyGoalComplete || !input.dailyQuestsComplete) &&
    input.preferences.dailyOverlayDismissedDay !== input.localDay;
}
