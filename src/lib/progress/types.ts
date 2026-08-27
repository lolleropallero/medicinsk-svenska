import type { VocabularyAnswerMode } from '../session';

export type ExerciseMode = 'flashcards' | 'phrases' | 'descriptions' | 'clinical';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type CosmeticType = 'theme' | 'cardStyle' | 'progressFrame' | 'title';
export type CapsuleKind = 'standard' | 'golden' | 'legendary';
export type DailyGoal = 5 | 10 | 20 | 30;
export type Resolution = 'mastered' | 'correct' | 'incorrect' | 'revealed';

export interface SessionStartedEvent {
  type: 'session-started'; eventId: string; sessionId: string; mode: ExerciseMode;
  sourceId: string; selectedCount: number; occurredAt: number;
}
export interface ItemCompletedEvent {
  type: 'item-completed'; eventId: string; sessionId: string; mode: ExerciseMode;
  itemId: string; sourceId: string; occurredAt: number; firstAttemptCorrect: boolean;
  hadMisses: boolean; resolution: Resolution;
}
export interface SessionCompletedEvent {
  type: 'session-completed'; eventId: string; sessionId: string; mode: ExerciseMode;
  sourceId: string; selectedCount: number; occurredAt: number;
}
export interface ActiveStudyEvent {
  type: 'active-study'; eventId: string; sessionId: string; mode: ExerciseMode;
  durationMs: number; occurredAt: number;
}
export type ProgressEvent = SessionStartedEvent | ItemCompletedEvent | SessionCompletedEvent | ActiveStudyEvent;

export interface Cosmetic {
  id: string; type: CosmeticType; rarity: Rarity; name: string; description: string; seasonExclusive?: boolean;
}
export interface Capsule {
  id: string; kind: CapsuleKind; earnedAt: number; openedAt?: number; rarity?: Rarity; reward?: Reward;
}
export type Reward =
  | { type: 'credits'; amount: number }
  | { type: 'capsule'; kind: CapsuleKind }
  | { type: 'cosmetic'; cosmeticId: string }
  | { type: 'rerollToken'; amount: number }
  | { type: 'streakFreeze'; amount: number };

export type QuestKind = 'items' | 'mode' | 'active' | 'variety' | 'retries' | 'sessions';
export interface Quest {
  id: string; slot: number; kind: QuestKind; label?: string; target: number; mode?: ExerciseMode;
  answerMode?: VocabularyAnswerMode;
  xp: number; credits: number; seasonPoints: number; rerollIndex: number; claimed: boolean;
}
export interface DailyProgress {
  uniqueItemIds: string[]; completedItems: number; activeStudyMs: number; xp: number;
  modes: ExerciseMode[]; sessionsStarted: number; sessionsCompleted: number; retriesMastered: number;
  goalTarget: DailyGoal; goalClaimed: boolean; qualified: boolean; freezeUsed: boolean;
  quests: Quest[]; freeRerollUsed: boolean; allQuestsClaimed: boolean; sessionDropEligible: number;
  sessionDropAwarded: boolean;
}
export interface Achievement { id: string; name: string; description: string; reward: Reward; unlockedAt?: number }
export interface SeasonState {
  id: string; index: number; points: number; claimedTiers: number[];
  history: { id: string; points: number; claimedTiers: number[] }[];
}
export type LeagueTier = 'Pronssi' | 'Hopea' | 'Kulta' | 'Platina' | 'Timantti' | 'Konsultti';
export type LeagueResult = { kind:'retained'|'promoted'|'demoted'; tier:LeagueTier };
export interface LeagueState { tier: LeagueTier; weekKey: string; weeklyXp: number; settledWeeks: string[]; previousResult?: string; result?: LeagueResult }
export type ProgressNotification = { id:string; kind:'level'; level:number }
  | { id:string; kind:'daily-goal'|'daily-quest'|'weekly-quest'|'achievement'|'golden-box'|'season-step'|'welcome-back' }
  | { id:string; kind:'league'; result:LeagueResult };
export type SessionReward = { kind:'xp'|'credits'|'season-points'; amount:number }
  | { kind:'daily-quest'|'daily-goal'|'golden-box'|'standard-box' };

export interface ProgressStateV1 {
  schemaVersion: 1; installationId: string; createdAt: number; updatedAt: number;
  settings: { dailyGoal: DailyGoal; calmMode: boolean };
  lifetime: { xp: number; activeStudyMs: number; completedItems: number; sessionsStarted: number;
    sessionsCompleted: number; studyDays: number; retriesMastered: number };
  daily: Record<string, DailyProgress>;
  streak: { current: number; longest: number; lastReconciledDay?: string; lastQualifiedDay?: string;
    rescue?: { day: string; previousStreak: number; progress: number }; lastRescueDay?: string };
  achievements: Achievement[];
  records: { mostItemsDay: number; mostActiveMsDay: number; mostXpDay: number; longestStreak: number; bestSevenDayItems: number };
  inventory: { credits: number; rerollTokens: number; streakFreezes: number; ownedCosmeticIds: string[];
    equipped: Record<CosmeticType, string>; capsules: Capsule[] };
  loot: { sinceRare: number; sinceEpic: number; sinceLegendary: number; openingHistory: string[] };
  seasons: SeasonState;
  league: LeagueState;
  comeback: { lastStudyDay?: string; handledGapEnd?: string; boostRemaining: number; boostMultiplier: number;
    chain?: { startDay: string; uniqueItems: string[]; modes: ExerciseMode[] } };
  highestRewardedLevel: number;
  processedEventIds: string[];
  notifications: ProgressNotification[];
  sessionRewards: Record<string, SessionReward[]>;
  lastUsedMode?: ExerciseMode;
}

export interface EventResult { state: ProgressStateV1; applied: boolean; earned: SessionReward[] }
