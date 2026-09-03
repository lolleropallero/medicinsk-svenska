import { describe, expect, it } from 'vitest';
import {
  advanceAnamnesisSession,
  assessAnamnesisItem,
  createAnamnesisSession,
  createNewAnamnesisRound,
  flattenAnamnesisCase,
  isAnamnesisSessionComplete,
  isStoredAnamnesisSession,
  revealAnamnesisItem,
  summarizeAnamnesisSession,
  updateAnamnesisDraft,
  type AnamnesisSession,
  type AnamnesisValidationContext,
} from '../../src/lib/anamnesis-session';
import type { AnamnesisCaseClient } from '../../src/types/content';

const testCase: AnamnesisCaseClient = {
  id: 'rintakipu',
  nameFi: 'Rintakipu',
  sections: [
    { id: 'a', nameFi: 'Osio A', items: [
      { id: 'rintakipu-01', patientSv: 'Patient ett.', modelQuestionsSv: ['Fråga ett?'] },
      { id: 'rintakipu-02', patientSv: 'Patient två.', modelQuestionsSv: ['Fråga två?', 'Alternativ två?'] },
    ] },
    { id: 'b', nameFi: 'Osio B', items: [
      { id: 'rintakipu-03', patientSv: 'Patient tre.', modelQuestionsSv: ['Fråga tre?'] },
    ] },
  ],
};
const baseConfiguration = { sessionId: 'session-one', caseId: 'rintakipu' };
const context = (expected = baseConfiguration): AnamnesisValidationContext => ({
  itemIdsByCaseId: new Map([['rintakipu', flattenAnamnesisCase(testCase).map((entry) => entry.item.id)]]),
  expected,
});

describe('flattening an anamnesis case', () => {
  it('produces one ordered entry per item with section context', () => {
    const flattened = flattenAnamnesisCase(testCase);
    expect(flattened.map((entry) => entry.item.id)).toEqual(['rintakipu-01', 'rintakipu-02', 'rintakipu-03']);
    expect(flattened.map((entry) => entry.sectionIndex)).toEqual([0, 0, 1]);
    expect(flattened.map((entry) => entry.indexInSection)).toEqual([0, 1, 0]);
    expect(flattened.map((entry) => entry.globalIndex)).toEqual([0, 1, 2]);
    expect(flattened.every((entry) => entry.sectionCount === 2)).toBe(true);
    expect(flattened[2]!.sectionNameFi).toBe('Osio B');
  });
});

describe('anamnesis session transitions', () => {
  it('creates an empty initial state', () => {
    const session = createAnamnesisSession(baseConfiguration, 123);
    expect(session).toMatchObject({
      schemaVersion: 1, sessionId: 'session-one', caseId: 'rintakipu', currentItemIndex: 0,
      currentDraftAnswer: '', currentRevealed: false, currentSelfAssessment: null, resultsByItem: {}, startedAt: 123,
    });
    expect(isAnamnesisSessionComplete(session, 3)).toBe(false);
  });

  it('updates the draft answer and stops once revealed', () => {
    let session = createAnamnesisSession(baseConfiguration, 0);
    session = updateAnamnesisDraft(session, 'Vad har ni för besvär?');
    expect(session.currentDraftAnswer).toBe('Vad har ni för besvär?');
    session = revealAnamnesisItem(session);
    const untouched = updateAnamnesisDraft(session, 'changed after reveal');
    expect(untouched).toBe(session);
  });

  it('reveals once and ignores a second call', () => {
    let session = createAnamnesisSession(baseConfiguration, 0);
    session = revealAnamnesisItem(session);
    expect(session.currentRevealed).toBe(true);
    expect(revealAnamnesisItem(session)).toBe(session);
  });

  it('requires a reveal before self-assessment, and ignores a second assessment', () => {
    let session = createAnamnesisSession(baseConfiguration, 0);
    expect(assessAnamnesisItem(session, 'knew')).toBe(session);
    session = revealAnamnesisItem(session);
    session = assessAnamnesisItem(session, 'did-not-know');
    expect(session.currentSelfAssessment).toBe('did-not-know');
    expect(assessAnamnesisItem(session, 'knew')).toBe(session);
  });

  it('does not advance before a self-assessment is recorded', () => {
    let session = createAnamnesisSession(baseConfiguration, 0);
    session = revealAnamnesisItem(session);
    expect(advanceAnamnesisSession(session, 'rintakipu-01')).toBe(session);
  });

  it('advances, records the result, and resets per-item state', () => {
    let session = createAnamnesisSession(baseConfiguration, 0);
    session = assessAnamnesisItem(revealAnamnesisItem(updateAnamnesisDraft(session, 'fråga')), 'knew');
    session = advanceAnamnesisSession(session, 'rintakipu-01');
    expect(session).toMatchObject({
      currentItemIndex: 1, currentDraftAnswer: '', currentRevealed: false, currentSelfAssessment: null,
      resultsByItem: { 'rintakipu-01': 'knew' },
    });
  });

  it('completes only once every item has advanced past', () => {
    let session = createAnamnesisSession(baseConfiguration, 0);
    const flattened = flattenAnamnesisCase(testCase);
    for (const entry of flattened) {
      expect(isAnamnesisSessionComplete(session, flattened.length)).toBe(false);
      session = assessAnamnesisItem(revealAnamnesisItem(session), entry.indexInSection === 0 ? 'knew' : 'did-not-know');
      session = advanceAnamnesisSession(session, entry.item.id);
    }
    expect(isAnamnesisSessionComplete(session, flattened.length)).toBe(true);
  });

  it('summarizes how many items were known versus not', () => {
    let session = createAnamnesisSession(baseConfiguration, 0);
    const flattened = flattenAnamnesisCase(testCase);
    const results: ('knew' | 'did-not-know')[] = ['knew', 'did-not-know', 'knew'];
    flattened.forEach((entry, index) => {
      session = assessAnamnesisItem(revealAnamnesisItem(session), results[index]!);
      session = advanceAnamnesisSession(session, entry.item.id);
    });
    expect(summarizeAnamnesisSession(session, flattened.length)).toEqual({ total: 3, knew: 2, didNotKnow: 1 });
  });

  it('starts a fresh round for the same case with reset progression', () => {
    let session = createAnamnesisSession(baseConfiguration, 123);
    session = advanceAnamnesisSession(assessAnamnesisItem(revealAnamnesisItem(session), 'knew'), 'rintakipu-01');
    const next = createNewAnamnesisRound(session, 'new-session', 456);
    expect(next).toMatchObject({
      sessionId: 'new-session', caseId: 'rintakipu', currentItemIndex: 0, currentDraftAnswer: '',
      currentRevealed: false, currentSelfAssessment: null, resultsByItem: {}, startedAt: 456,
    });
  });
});

describe('stored anamnesis session validation', () => {
  const valid = () => createAnamnesisSession(baseConfiguration, 123);
  it('round-trips fresh, drafted, revealed, assessed, and advanced states', () => {
    let session = valid();
    expect(isStoredAnamnesisSession(JSON.parse(JSON.stringify(session)), context())).toBe(true);
    session = updateAnamnesisDraft(session, 'fråga');
    expect(isStoredAnamnesisSession(JSON.parse(JSON.stringify(session)), context())).toBe(true);
    session = revealAnamnesisItem(session);
    expect(isStoredAnamnesisSession(JSON.parse(JSON.stringify(session)), context())).toBe(true);
    session = assessAnamnesisItem(session, 'knew');
    expect(isStoredAnamnesisSession(JSON.parse(JSON.stringify(session)), context())).toBe(true);
    session = advanceAnamnesisSession(session, 'rintakipu-01');
    expect(isStoredAnamnesisSession(JSON.parse(JSON.stringify(session)), context())).toBe(true);
  });

  it('round-trips a fully completed session', () => {
    let session = valid();
    const flattened = flattenAnamnesisCase(testCase);
    for (const entry of flattened) {
      session = assessAnamnesisItem(revealAnamnesisItem(session), 'knew');
      session = advanceAnamnesisSession(session, entry.item.id);
    }
    expect(isAnamnesisSessionComplete(session, flattened.length)).toBe(true);
    expect(isStoredAnamnesisSession(JSON.parse(JSON.stringify(session)), context())).toBe(true);
  });

  it.each([
    ['unknown case', (s: AnamnesisSession) => ({ ...s, caseId: 'missing' })],
    ['negative index', (s: AnamnesisSession) => ({ ...s, currentItemIndex: -1 })],
    ['index past the end', (s: AnamnesisSession) => ({ ...s, currentItemIndex: 99 })],
    ['incompatible schema version', (s: AnamnesisSession) => ({ ...s, schemaVersion: 2 })],
    ['unreasonable session ID', (s: AnamnesisSession) => ({ ...s, sessionId: '../../etc' })],
    ['non-object results map', (s: AnamnesisSession) => ({ ...s, resultsByItem: [] })],
    ['non-string draft', (s: AnamnesisSession) => ({ ...s, currentDraftAnswer: 5 })],
    ['self-assessment without a reveal', (s: AnamnesisSession) => ({ ...s, currentSelfAssessment: 'knew' })],
  ] as const)('rejects %s', (_label, mutate) => {
    const session = valid();
    expect(isStoredAnamnesisSession(mutate(session), context())).toBe(false);
  });

  it('rejects a results entry for an unknown item ID', () => {
    let session = valid();
    session = advanceAnamnesisSession(assessAnamnesisItem(revealAnamnesisItem(session), 'knew'), 'rintakipu-01');
    const tampered = { ...session, resultsByItem: { ...session.resultsByItem, unknown: 'knew' } };
    expect(isStoredAnamnesisSession(tampered, context())).toBe(false);
  });

  it('rejects a missing result for an item before the current pointer', () => {
    let session = valid();
    session = advanceAnamnesisSession(assessAnamnesisItem(revealAnamnesisItem(session), 'knew'), 'rintakipu-01');
    expect(isStoredAnamnesisSession({ ...session, resultsByItem: {} }, context())).toBe(false);
  });

  it('rejects a result recorded for the not-yet-reached current item', () => {
    const session = valid();
    const invalid = { ...session, resultsByItem: { 'rintakipu-01': 'knew' as const } };
    expect(isStoredAnamnesisSession(invalid, context())).toBe(false);
  });

  it('rejects a completed session that still carries in-progress per-item state', () => {
    let session = valid();
    const flattened = flattenAnamnesisCase(testCase);
    for (const entry of flattened) session = advanceAnamnesisSession(assessAnamnesisItem(revealAnamnesisItem(session), 'knew'), entry.item.id);
    expect(isStoredAnamnesisSession({ ...session, currentRevealed: true }, context())).toBe(false);
    expect(isStoredAnamnesisSession({ ...session, currentDraftAnswer: 'x' }, context())).toBe(false);
  });

  it('rejects a session ID or case ID mismatch against the expected URL configuration', () => {
    const session = valid();
    expect(isStoredAnamnesisSession(session, context({ ...baseConfiguration, sessionId: 'different' }))).toBe(false);
    expect(isStoredAnamnesisSession(session, context({ ...baseConfiguration, caseId: 'different' }))).toBe(false);
  });
});
