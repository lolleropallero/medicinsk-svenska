import { levelProgress } from './core';
import { achievementCopy, questCopy, weeklyQuestCopy } from './copy';
import type { Achievement, ProgressStateV1, Quest, Reward } from './types';

export interface AchievementMilestone {
  id: string;
  name: string;
  description: string;
  reward: Reward;
}

export interface QuestMilestone {
  id: string;
  name: string;
  reward: { xp: number; credits: number; seasonPoints: number };
}

export interface MilestoneBatch {
  sourceEventIds: string[];
  levelUp: { from: number; to: number } | null;
  achievements: AchievementMilestone[];
  completedDailyQuests: QuestMilestone[];
  completedWeeklyQuests: QuestMilestone[];
}

const achievementMilestone = (achievement: Achievement): AchievementMilestone => ({
  id: achievement.id,
  ...achievementCopy(achievement),
  reward: structuredClone(achievement.reward),
});

const dailyMilestone = (quest: Quest): QuestMilestone => ({
  id: quest.id,
  name: questCopy(quest).sv,
  reward: { xp: quest.xp, credits: quest.credits, seasonPoints: quest.seasonPoints },
});

const weeklyIds = ['days', 'items', 'modes'] as const;

export function deriveMilestoneBatch(
  before: ProgressStateV1,
  after: ProgressStateV1,
  sourceEventId: string,
): MilestoneBatch | null {
  const from = levelProgress(before.lifetime.xp).level;
  const to = levelProgress(after.lifetime.xp).level;
  const priorAchievements = new Map(before.achievements.map((item) => [item.id, Boolean(item.unlockedAt)]));
  const achievements = after.achievements
    .filter((item) => Boolean(item.unlockedAt) && !priorAchievements.get(item.id))
    .map(achievementMilestone);

  const priorDailyClaims = new Set(
    Object.values(before.daily).flatMap((day) => day.quests.filter((quest) => quest.claimed).map((quest) => quest.id)),
  );
  const completedDailyQuests = Object.values(after.daily)
    .flatMap((day) => day.quests)
    .filter((quest) => quest.claimed && !priorDailyClaims.has(quest.id))
    .map(dailyMilestone);

  const priorEvents = new Set(before.processedEventIds);
  const completedWeeklyQuests = after.processedEventIds.flatMap((id) => {
    if (priorEvents.has(id)) return [];
    const match = /^weekly:[^:]+:(days|items|modes)$/.exec(id);
    if (!match) return [];
    const index = weeklyIds.indexOf(match[1] as (typeof weeklyIds)[number]);
    return [{
      id,
      name: weeklyQuestCopy[index]!.sv,
      reward: { xp: 25, credits: 30, seasonPoints: 30 },
    } satisfies QuestMilestone];
  });

  const batch: MilestoneBatch = {
    sourceEventIds: [sourceEventId],
    levelUp: to > from ? { from, to } : null,
    achievements,
    completedDailyQuests,
    completedWeeklyQuests,
  };
  return isMilestoneBatchEmpty(batch) ? null : batch;
}

export function isMilestoneBatchEmpty(batch: MilestoneBatch): boolean {
  return !batch.levelUp
    && batch.achievements.length === 0
    && batch.completedDailyQuests.length === 0
    && batch.completedWeeklyQuests.length === 0;
}

const uniqueById = <T extends { id: string }>(items: T[]) =>
  items.filter((item, index) => items.findIndex((candidate) => candidate.id === item.id) === index);

export function mergeMilestoneBatches(left: MilestoneBatch, right: MilestoneBatch): MilestoneBatch {
  return {
    sourceEventIds: [...new Set([...left.sourceEventIds, ...right.sourceEventIds])],
    levelUp: left.levelUp || right.levelUp
      ? { from: left.levelUp?.from ?? right.levelUp!.from, to: right.levelUp?.to ?? left.levelUp!.to }
      : null,
    achievements: uniqueById([...left.achievements, ...right.achievements]),
    completedDailyQuests: uniqueById([...left.completedDailyQuests, ...right.completedDailyQuests]),
    completedWeeklyQuests: uniqueById([...left.completedWeeklyQuests, ...right.completedWeeklyQuests]),
  };
}

export type MilestoneFeedback = 'level-up' | 'achievement' | 'quest-complete';
export function milestoneFeedback(batch: MilestoneBatch): MilestoneFeedback | null {
  if (isMilestoneBatchEmpty(batch)) return null;
  if (batch.levelUp) return 'level-up';
  if (batch.achievements.length) return 'achievement';
  return 'quest-complete';
}

export function milestoneNotificationIds(batch: MilestoneBatch): Set<string> {
  const ids = new Set<string>();
  if (batch.levelUp) for (let level = batch.levelUp.from + 1; level <= batch.levelUp.to; level++) ids.add(`level:${level}`);
  for (const achievement of batch.achievements) ids.add(`achievement:${achievement.id}`);
  for (const quest of batch.completedDailyQuests) ids.add(`quest:${quest.id}`);
  for (const quest of batch.completedWeeklyQuests) ids.add(quest.id);
  return ids;
}

let pending: MilestoneBatch | null = null;

export function enqueueMilestoneBatch(batch: MilestoneBatch): boolean {
  if (isMilestoneBatchEmpty(batch)) return false;
  pending = pending ? mergeMilestoneBatches(pending, batch) : batch;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('milestone-batch-pending'));
  return true;
}

export function peekPendingMilestoneBatch(): MilestoneBatch | null { return pending; }
export function takePendingMilestoneBatch(): MilestoneBatch | null {
  const batch = pending;
  pending = null;
  return batch;
}

export function resetMilestoneQueueForTests() { pending = null; }

declare global { interface WindowEventMap { 'milestone-batch-pending': CustomEvent<void> } }
