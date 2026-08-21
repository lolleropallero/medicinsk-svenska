import { localDayKey } from './calendar';

export const UI_PREFERENCES_KEY = 'medicinsk-svenska.ui.v1';
export const UI_PREFERENCES_SCHEMA_VERSION = 1 as const;

export interface UiPreferencesV1 {
  schemaVersion: typeof UI_PREFERENCES_SCHEMA_VERSION;
  dailyOverlayDismissedDay?: string;
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
  return { schemaVersion: UI_PREFERENCES_SCHEMA_VERSION };
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
    return candidate.dailyOverlayDismissedDay
      ? { schemaVersion: UI_PREFERENCES_SCHEMA_VERSION, dailyOverlayDismissedDay: candidate.dailyOverlayDismissedDay }
      : defaultUiPreferences();
  } catch {
    return defaultUiPreferences();
  }
}

export function loadUiPreferences(storage: Pick<Storage, 'getItem'> = localStorage): UiPreferencesV1 {
  return parseUiPreferences(storage.getItem(UI_PREFERENCES_KEY));
}

export function dismissDailyOverlay(
  storage: Pick<Storage, 'setItem'> = localStorage,
  date = new Date(),
): UiPreferencesV1 {
  const preferences: UiPreferencesV1 = {
    schemaVersion: UI_PREFERENCES_SCHEMA_VERSION,
    dailyOverlayDismissedDay: localDayKey(date),
  };
  storage.setItem(UI_PREFERENCES_KEY, JSON.stringify(preferences));
  return preferences;
}

export function shouldAutoOpenDailyOverlay(input: DailyOverlayEligibility): boolean {
  return input.pathname === '/' &&
    !input.calmMode &&
    !input.otherModalOpen &&
    (!input.dailyGoalComplete || !input.dailyQuestsComplete) &&
    input.preferences.dailyOverlayDismissedDay !== input.localDay;
}
