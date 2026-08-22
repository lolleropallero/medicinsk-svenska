import type { ExerciseMode, Quest } from './types';

export interface ResumableSession {
  href: string;
  startedAt: number;
}

export interface QuestActionContext {
  lastUsedMode?: ExerciseMode;
  modesUsedToday: readonly ExerciseMode[];
  sessions: Partial<Record<ExerciseMode, ResumableSession>>;
  freshUrls: Record<ExerciseMode, string>;
}

export interface QuestAction {
  mode: ExerciseMode;
  href: string;
  resumesSession: boolean;
}

const MODES: readonly ExerciseMode[] = ['flashcards', 'phrases', 'descriptions'];

function actionFor(mode: ExerciseMode, context: QuestActionContext, allowResume = true): QuestAction {
  const session = allowResume ? context.sessions[mode] : undefined;
  return session
    ? { mode, href: session.href, resumesSession: true }
    : { mode, href: context.freshUrls[mode], resumesSession: false };
}

function mostRecentSession(context: QuestActionContext): ExerciseMode | undefined {
  return MODES.filter((mode) => context.sessions[mode])
    .sort((left, right) => context.sessions[right]!.startedAt - context.sessions[left]!.startedAt)[0];
}

export function resolveDailyQuestAction(quest: Quest, context: QuestActionContext): QuestAction | null {
  if (quest.claimed) return null;
  if (quest.kind === 'mode' && quest.mode) return actionFor(quest.mode, context);

  if (quest.kind === 'items') {
    const mode = context.lastUsedMode;
    return mode && context.sessions[mode]
      ? actionFor(mode, context)
      : actionFor('flashcards', context, false);
  }

  if (quest.kind === 'active') {
    const mode = mostRecentSession(context) ?? context.lastUsedMode ?? 'flashcards';
    return actionFor(mode, context);
  }

  if (quest.kind === 'variety') {
    const unusedModes = MODES.filter((mode) => !context.modesUsedToday.includes(mode));
    const mode = unusedModes.find((candidate) => context.sessions[candidate]) ?? unusedModes[0] ?? 'flashcards';
    return actionFor(mode, context);
  }

  if (quest.kind === 'retries') {
    const preferred = context.lastUsedMode === 'phrases' || context.lastUsedMode === 'flashcards'
      ? context.lastUsedMode : 'flashcards';
    const mode = context.sessions[preferred]
      ? preferred
      : preferred === 'flashcards' && context.sessions.phrases ? 'phrases'
      : 'flashcards';
    return actionFor(mode, context);
  }

  const mode = context.lastUsedMode ?? 'flashcards';
  return actionFor(mode, context);
}
