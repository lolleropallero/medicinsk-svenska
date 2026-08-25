import type { ExerciseMode, Quest } from './types';
import type { VocabularyAnswerMode } from '../session';

export interface ResumableSession {
  href: string;
  startedAt: number;
  answerMode?: VocabularyAnswerMode;
}

export interface QuestActionContext {
  lastUsedMode?: ExerciseMode;
  modesUsedToday: readonly ExerciseMode[];
  sessions: Partial<Record<ExerciseMode, ResumableSession>>;
  freshUrls: Record<ExerciseMode, string>;
  freshFlashcardUrls?: Partial<Record<VocabularyAnswerMode, string>>;
}

export interface QuestAction {
  mode: ExerciseMode;
  href: string;
  resumesSession: boolean;
}

const MODES: readonly ExerciseMode[] = ['flashcards', 'phrases', 'descriptions'];

function freshUrlFor(mode: ExerciseMode, context: QuestActionContext, answerMode?: VocabularyAnswerMode): string {
  return mode === 'flashcards' && answerMode
    ? context.freshFlashcardUrls?.[answerMode] ?? context.freshUrls.flashcards
    : context.freshUrls[mode];
}

function canResume(mode: ExerciseMode, session: ResumableSession, answerMode?: VocabularyAnswerMode): boolean {
  return mode !== 'flashcards' || !answerMode || session.answerMode === answerMode;
}

function actionFor(mode: ExerciseMode, context: QuestActionContext, allowResume = true, answerMode?: VocabularyAnswerMode): QuestAction {
  const session = allowResume ? context.sessions[mode] : undefined;
  return session && canResume(mode, session, answerMode)
    ? { mode, href: session.href, resumesSession: true }
    : { mode, href: freshUrlFor(mode, context, answerMode), resumesSession: false };
}

function mostRecentSession(context: QuestActionContext): ExerciseMode | undefined {
  return MODES.filter((mode) => context.sessions[mode])
    .sort((left, right) => context.sessions[right]!.startedAt - context.sessions[left]!.startedAt)[0];
}

export function resolveDailyQuestAction(quest: Quest, context: QuestActionContext): QuestAction | null {
  if (quest.claimed) return null;
  if (quest.kind === 'mode' && quest.mode) return actionFor(quest.mode, context, true, quest.answerMode);

  if (quest.kind === 'items') {
    const mode = context.lastUsedMode;
    return mode && context.sessions[mode]
      ? actionFor(mode, context, true, quest.answerMode)
      : actionFor('flashcards', context, false, quest.answerMode);
  }

  if (quest.kind === 'active') {
    const mode = mostRecentSession(context) ?? context.lastUsedMode ?? 'flashcards';
    return actionFor(mode, context, true, quest.answerMode);
  }

  if (quest.kind === 'variety') {
    const unusedModes = MODES.filter((mode) => !context.modesUsedToday.includes(mode));
    const mode = unusedModes.find((candidate) => context.sessions[candidate]) ?? unusedModes[0] ?? 'flashcards';
    return actionFor(mode, context, true, quest.answerMode);
  }

  if (quest.kind === 'retries') {
    const preferred = context.lastUsedMode === 'phrases' || context.lastUsedMode === 'flashcards'
      ? context.lastUsedMode : 'flashcards';
    const mode = context.sessions[preferred]
      ? preferred
      : preferred === 'flashcards' && context.sessions.phrases ? 'phrases'
      : 'flashcards';
    return actionFor(mode, context, true, quest.answerMode);
  }

  const mode = context.lastUsedMode ?? 'flashcards';
  return actionFor(mode, context, true, quest.answerMode);
}
