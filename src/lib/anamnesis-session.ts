import type { AnamnesisCaseClient, AnamnesisItem } from '../types/content';

export const ANAMNESIS_SESSION_SCHEMA_VERSION = 1 as const;
export type AnamnesisSelfAssessment = 'knew' | 'did-not-know';

export interface AnamnesisSessionConfiguration {
  sessionId: string;
  caseId: string;
}

export interface AnamnesisSession extends AnamnesisSessionConfiguration {
  schemaVersion: typeof ANAMNESIS_SESSION_SCHEMA_VERSION;
  currentItemIndex: number;
  currentDraftAnswer: string;
  currentRevealed: boolean;
  currentSelfAssessment: AnamnesisSelfAssessment | null;
  resultsByItem: Record<string, AnamnesisSelfAssessment>;
  startedAt: number;
}

export interface FlattenedAnamnesisItem {
  item: AnamnesisItem;
  sectionId: string;
  sectionNameFi: string;
  sectionIndex: number;
  sectionCount: number;
  indexInSection: number;
  globalIndex: number;
}

export interface AnamnesisValidationContext {
  itemIdsByCaseId: ReadonlyMap<string, readonly string[]>;
  expected: AnamnesisSessionConfiguration;
}

export interface AnamnesisSessionSummary {
  total: number;
  knew: number;
  didNotKnow: number;
}

/** Flattens a case's sections into one ordered list, keeping the section context each item needs for rendering. */
export function flattenAnamnesisCase(anamnesisCase: AnamnesisCaseClient): FlattenedAnamnesisItem[] {
  const flattened: FlattenedAnamnesisItem[] = [];
  anamnesisCase.sections.forEach((section, sectionIndex) => {
    section.items.forEach((item, indexInSection) => {
      flattened.push({
        item, sectionId: section.id, sectionNameFi: section.nameFi, sectionIndex,
        sectionCount: anamnesisCase.sections.length, indexInSection, globalIndex: flattened.length,
      });
    });
  });
  return flattened;
}

export function createAnamnesisSession(configuration: AnamnesisSessionConfiguration, now = Date.now()): AnamnesisSession {
  return {
    schemaVersion: ANAMNESIS_SESSION_SCHEMA_VERSION,
    sessionId: configuration.sessionId,
    caseId: configuration.caseId,
    currentItemIndex: 0,
    currentDraftAnswer: '',
    currentRevealed: false,
    currentSelfAssessment: null,
    resultsByItem: {},
    startedAt: now,
  };
}

export function isAnamnesisSessionComplete(session: AnamnesisSession, totalItems: number): boolean {
  return session.currentItemIndex >= totalItems;
}

/** Updates the in-progress typed question; a no-op once the model question has been revealed. */
export function updateAnamnesisDraft(session: AnamnesisSession, draft: string): AnamnesisSession {
  if (session.currentRevealed) return session;
  return { ...session, currentDraftAnswer: draft };
}

export function revealAnamnesisItem(session: AnamnesisSession): AnamnesisSession {
  if (session.currentRevealed) return session;
  return { ...session, currentRevealed: true };
}

/** Records the learner's self-assessment; a second call before advancing is a no-op. */
export function assessAnamnesisItem(session: AnamnesisSession, assessment: AnamnesisSelfAssessment): AnamnesisSession {
  if (!session.currentRevealed || session.currentSelfAssessment) return session;
  return { ...session, currentSelfAssessment: assessment };
}

/** Moves past the just-assessed item; a no-op until a self-assessment has been recorded. */
export function advanceAnamnesisSession(session: AnamnesisSession, currentItemId: string): AnamnesisSession {
  if (!session.currentSelfAssessment) return session;
  return {
    ...session,
    currentItemIndex: session.currentItemIndex + 1,
    currentDraftAnswer: '',
    currentRevealed: false,
    currentSelfAssessment: null,
    resultsByItem: { ...session.resultsByItem, [currentItemId]: session.currentSelfAssessment },
  };
}

export function summarizeAnamnesisSession(session: AnamnesisSession, totalItems: number): AnamnesisSessionSummary {
  const results = Object.values(session.resultsByItem);
  return {
    total: totalItems,
    knew: results.filter((result) => result === 'knew').length,
    didNotKnow: results.filter((result) => result === 'did-not-know').length,
  };
}

export function createNewAnamnesisRound(session: AnamnesisSession, sessionId: string, now = Date.now()): AnamnesisSession {
  return createAnamnesisSession({ sessionId, caseId: session.caseId }, now);
}

export function isReasonableAnamnesisSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/u.test(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const isSelfAssessment = (value: unknown): value is AnamnesisSelfAssessment => value === 'knew' || value === 'did-not-know';

export function isStoredAnamnesisSession(value: unknown, context: AnamnesisValidationContext): value is AnamnesisSession {
  if (!isPlainRecord(value)) return false;
  const session = value as Partial<AnamnesisSession>;
  const itemIds = typeof session.caseId === 'string' ? context.itemIdsByCaseId.get(session.caseId) : undefined;
  const results = session.resultsByItem;

  if (!(
    session.schemaVersion === ANAMNESIS_SESSION_SCHEMA_VERSION &&
    isReasonableAnamnesisSessionId(session.sessionId) &&
    itemIds !== undefined &&
    Number.isInteger(session.currentItemIndex) && Number(session.currentItemIndex) >= 0 && Number(session.currentItemIndex) <= itemIds.length &&
    typeof session.currentDraftAnswer === 'string' &&
    typeof session.currentRevealed === 'boolean' &&
    (session.currentSelfAssessment === null || isSelfAssessment(session.currentSelfAssessment)) &&
    (!session.currentSelfAssessment || session.currentRevealed) &&
    isPlainRecord(results) &&
    typeof session.startedAt === 'number' && Number.isFinite(session.startedAt) && session.startedAt >= 0 &&
    session.sessionId === context.expected.sessionId && session.caseId === context.expected.caseId
  )) return false;

  const currentItemIndex = Number(session.currentItemIndex);
  const complete = currentItemIndex >= itemIds.length;
  if (complete && (session.currentRevealed || session.currentSelfAssessment !== null || session.currentDraftAnswer !== '')) return false;

  const resultEntries = Object.entries(results);
  if (!resultEntries.every(([id, result]) => itemIds.includes(id) && isSelfAssessment(result))) return false;
  if (resultEntries.length !== currentItemIndex) return false;
  if (!itemIds.slice(0, currentItemIndex).every((id) => Object.hasOwn(results, id))) return false;
  if (!complete && Object.hasOwn(results, itemIds[currentItemIndex]!)) return false;
  return true;
}
