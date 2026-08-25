import { describe, expect, it } from 'vitest';
import {
  defaultUiPreferences,
  dismissDailyOverlay,
  markDailyOverlayHandled,
  parseUiPreferences,
  shouldAutoOpenDailyOverlay,
  UI_PREFERENCES_KEY,
} from '../../src/lib/progress/ui-preferences';

class MemoryStorage {
  values = new Map<string,string>();
  getItem(key:string){ return this.values.get(key) ?? null; }
  setItem(key:string,value:string){ this.values.set(key,value); }
}

const eligible = (overrides: Partial<Parameters<typeof shouldAutoOpenDailyOverlay>[0]> = {}) => shouldAutoOpenDailyOverlay({
  pathname: '/', localDay: '2026-08-21', preferences: defaultUiPreferences(), calmMode: false,
  dailyGoalComplete: false, dailyQuestsComplete: false, otherModalOpen: false, ...overrides,
});

describe('daily overlay UI preferences', () => {
  it('defaults safely when absent or corrupt', () => {
    expect(parseUiPreferences(null)).toEqual({ schemaVersion: 1, soundEnabled:true, soundVolume:.65, musicEnabled:true, musicVolume:0 });
    expect(parseUiPreferences('{broken')).toEqual({ schemaVersion: 1, soundEnabled:true, soundVolume:.65, musicEnabled:true, musicVolume:0 });
    expect(parseUiPreferences('{"schemaVersion":2}')).toEqual({ schemaVersion: 1, soundEnabled:true, soundVolume:.65, musicEnabled:true, musicVolume:0 });
    expect(parseUiPreferences('{"schemaVersion":1,"dailyOverlayDismissedDay":"today"}')).toEqual({ schemaVersion: 1, soundEnabled:true, soundVolume:.65, musicEnabled:true, musicVolume:0 });
  });

  it('stores dismissal for the controlled local date without touching progress', () => {
    const storage = new MemoryStorage();
    storage.setItem('medicinsk-svenska.progress.v1', '{"economy":"unchanged"}');
    dismissDailyOverlay(storage, new Date(2026, 7, 21, 9));
    expect(JSON.parse(storage.getItem(UI_PREFERENCES_KEY)!)).toEqual({ schemaVersion: 1, soundEnabled:true, soundVolume:.65, musicEnabled:true, musicVolume:0, dailyOverlayDismissedDay: '2026-08-21' });
    expect(storage.getItem('medicinsk-svenska.progress.v1')).toBe('{"economy":"unchanged"}');
  });

  it('marks quest activation handled for today and permits automatic opening tomorrow', () => {
    const storage = new MemoryStorage();
    const preferences = markDailyOverlayHandled(storage, new Date(2026, 7, 21, 9));
    expect(preferences).toEqual({ schemaVersion: 1, soundEnabled:true, soundVolume:.65, musicEnabled:true, musicVolume:0, dailyOverlayDismissedDay: '2026-08-21' });
    expect(eligible({ preferences })).toBe(false);
    expect(eligible({ localDay: '2026-08-22', preferences })).toBe(true);
  });

  it('opens once on an eligible day and becomes eligible on the next local day', () => {
    const preferences = { schemaVersion: 1 as const, soundEnabled:true, soundVolume:.65, musicEnabled:true, musicVolume:0, dailyOverlayDismissedDay: '2026-08-21' };
    expect(eligible({ preferences })).toBe(false);
    expect(eligible({ localDay: '2026-08-22', preferences })).toBe(true);
  });

  it('does not auto-open in calm mode, off home, with another modal, or when all daily work is complete', () => {
    expect(eligible({ calmMode: true })).toBe(false);
    expect(eligible({ pathname: '/kortit/' })).toBe(false);
    expect(eligible({ otherModalOpen: true })).toBe(false);
    expect(eligible({ dailyGoalComplete: true, dailyQuestsComplete: true })).toBe(false);
    expect(eligible({ dailyGoalComplete: true, dailyQuestsComplete: false })).toBe(true);
    expect(eligible({ dailyGoalComplete: false, dailyQuestsComplete: true })).toBe(true);
  });
});
