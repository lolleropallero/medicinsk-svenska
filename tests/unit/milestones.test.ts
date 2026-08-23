import { beforeEach, describe, expect, it } from 'vitest';
import { createProgressState, emptyDay, levelThreshold } from '../../src/lib/progress/core';
import {
  deriveMilestoneBatch,
  enqueueMilestoneBatch,
  isMilestoneBatchEmpty,
  mergeMilestoneBatches,
  milestoneFeedback,
  milestoneNotificationIds,
  peekPendingMilestoneBatch,
  resetMilestoneQueueForTests,
  takePendingMilestoneBatch,
  type MilestoneBatch,
} from '../../src/lib/progress/milestones';

const now = new Date('2026-08-23T12:00:00+03:00').getTime();
const dayKey = '2026-08-23';
const beforeState = () => createProgressState(now, 'milestone-tests');

function achievement(after: ReturnType<typeof beforeState>, id = 'first-item') {
  after.achievements.find((item) => item.id === id)!.unlockedAt = now;
}

function dailyQuest(after: ReturnType<typeof beforeState>, index = 0) {
  const day = after.daily[dayKey] ?? emptyDay(after, dayKey);
  after.daily[dayKey] = day;
  day.quests[index]!.claimed = true;
}

function weeklyQuest(after: ReturnType<typeof beforeState>, id: 'days' | 'items' | 'modes' = 'days') {
  after.processedEventIds.push(`weekly:2026-08-17:${id}`);
}

const derive = (mutate: (after: ReturnType<typeof beforeState>) => void) => {
  const before = beforeState();
  const after = structuredClone(before);
  mutate(after);
  return deriveMilestoneBatch(before, after, 'action-1')!;
};

describe('MilestoneBatch derivation', () => {
  beforeEach(resetMilestoneQueueForTests);

  it('derives an achievement-only batch with real visible copy and one semantic fanfare', () => {
    const batch = derive((after) => achievement(after));
    expect(batch.achievements).toEqual([expect.objectContaining({ id: 'first-item', name: 'Första steget', description: 'Slutför din första uppgift.' })]);
    expect(milestoneFeedback(batch)).toBe('achievement');
  });

  it('derives a level-only batch showing the resulting level', () => {
    const batch = derive((after) => { after.lifetime.xp = levelThreshold(8); });
    expect(batch.levelUp).toEqual({ from: 1, to: 8 });
    expect(milestoneFeedback(batch)).toBe('level-up');
  });

  it('derives a daily-quest-only batch with the actual quest and reward', () => {
    const batch = derive((after) => dailyQuest(after));
    expect(batch.completedDailyQuests[0]).toMatchObject({ name: 'Gör 10 olika uppgifter', reward: { xp: 5, credits: 10, seasonPoints: 10 } });
    expect(milestoneFeedback(batch)).toBe('quest-complete');
  });

  it('derives a weekly-quest-only batch with the actual weekly copy', () => {
    const batch = derive((after) => weeklyQuest(after, 'items'));
    expect(batch.completedWeeklyQuests[0]).toMatchObject({ name: 'Gör 100 olika uppgifter', reward: { xp: 25, credits: 30, seasonPoints: 30 } });
    expect(milestoneFeedback(batch)).toBe('quest-complete');
  });

  it('keeps level and achievement in one prioritized batch', () => {
    const batch = derive((after) => { after.lifetime.xp = levelThreshold(2); achievement(after); });
    expect(batch.levelUp?.to).toBe(2);
    expect(batch.achievements).toHaveLength(1);
    expect(milestoneFeedback(batch)).toBe('level-up');
  });

  it('keeps achievement and daily quest in one batch', () => {
    const batch = derive((after) => { achievement(after); dailyQuest(after); });
    expect(batch.achievements).toHaveLength(1);
    expect(batch.completedDailyQuests).toHaveLength(1);
    expect(milestoneFeedback(batch)).toBe('achievement');
  });

  it('keeps level, achievement, daily quest, and weekly quest in one batch', () => {
    const batch = derive((after) => {
      after.lifetime.xp = levelThreshold(3);
      achievement(after);
      dailyQuest(after);
      weeklyQuest(after, 'modes');
    });
    expect(batch.levelUp?.to).toBe(3);
    expect(batch.achievements).toHaveLength(1);
    expect(batch.completedDailyQuests).toHaveLength(1);
    expect(batch.completedWeeklyQuests).toHaveLength(1);
    expect(milestoneFeedback(batch)).toBe('level-up');
    expect([...milestoneNotificationIds(batch)]).toEqual([
      'level:2', 'level:3', 'achievement:first-item',
      `quest:${batch.completedDailyQuests[0]!.id}`, batch.completedWeeklyQuests[0]!.id,
    ]);
  });

  it('shows two simultaneous achievements in the same batch', () => {
    const batch = derive((after) => { achievement(after); achievement(after, 'items-10'); });
    expect(batch.achievements.map((item) => item.name)).toEqual(['Första steget', 'En bra början']);
    expect(milestoneFeedback(batch)).toBe('achievement');
  });

  it('collapses a multi-level jump to the final level', () => {
    const batch = derive((after) => { after.lifetime.xp = levelThreshold(9); });
    expect(batch.levelUp).toEqual({ from: 1, to: 9 });
  });

  it('silently establishes persisted level, achievement, and quest baselines', () => {
    const persisted = beforeState();
    persisted.lifetime.xp = levelThreshold(8);
    achievement(persisted);
    dailyQuest(persisted);
    weeklyQuest(persisted);
    expect(deriveMilestoneBatch(persisted, structuredClone(persisted), 'load')).toBeNull();
    expect(peekPendingMilestoneBatch()).toBeNull();
  });

  it('rejects empty dialogs and gives a queued non-empty batch exactly one feedback reason', () => {
    const empty: MilestoneBatch = { sourceEventIds: [], levelUp: null, achievements: [], completedDailyQuests: [], completedWeeklyQuests: [] };
    expect(isMilestoneBatchEmpty(empty)).toBe(true);
    expect(enqueueMilestoneBatch(empty)).toBe(false);
    expect(milestoneFeedback(empty)).toBeNull();
    const batch = derive((after) => achievement(after));
    expect(enqueueMilestoneBatch(batch)).toBe(true);
    expect(takePendingMilestoneBatch()).toEqual(batch);
    expect(takePendingMilestoneBatch()).toBeNull();
  });

  it('merges milestones arriving during the same visual handoff into one presentation', () => {
    const level = derive((after) => { after.lifetime.xp = levelThreshold(2); });
    const achievements = derive((after) => { achievement(after); achievement(after, 'items-10'); });
    const merged = mergeMilestoneBatches(level, achievements);
    expect(merged.levelUp?.to).toBe(2);
    expect(merged.achievements).toHaveLength(2);
    expect(milestoneFeedback(merged)).toBe('level-up');
  });
});
