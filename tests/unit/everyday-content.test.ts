import { describe, expect, it } from 'vitest';
import vocabulary from '../../content/everyday-vocabulary.json';
import { validateEverydayContent } from '../../scripts/validate-everyday-content';
import { everydayCardPayload as cards, everydayDeckPayload as decks } from '../../src/lib/everyday-content';
import { everydayTestTerms } from '../../src/lib/everyday-test-content';
import { flashcardPayload } from '../../src/lib/content';
import { examCardPayload } from '../../src/lib/exam-content';
import { cardSides, createNewRoundSession, createSession, seededRandom } from '../../src/lib/session';
import { createExamTest, gradeExamTest, isStoredExamTest, scoreExamTestAnswer } from '../../src/lib/exam-test-session';
import { selectDifficultCardIds, selectWeakCards, type WordStatsStateV1 } from '../../src/lib/vocabulary-stats';

describe('independent everyday vocabulary', () => {
  it('ships 500 distinct Swedish words in 20 complete topic decks', () => {
    expect(validateEverydayContent(vocabulary)).toEqual([]);
    expect(cards).toHaveLength(500);
    expect(decks).toHaveLength(20);
    expect(new Set(cards.map(card => card.sv)).size).toBe(500);
    expect(decks.every(deck => cards.filter(card => card.deckId === deck.id).length === 25)).toBe(true);
    const medicalIds = new Set([...flashcardPayload, ...examCardPayload].map(card => card.id));
    expect(cards.every(card => !medicalIds.has(card.id))).toBe(true);
    expect(cards.every(card => !('status' in card) && !('sourceFile' in card))).toBe(true);
  });

  it('rejects missing cards, repeated words and incorrect grammar field kinds', () => {
    expect(validateEverydayContent(vocabulary.slice(1))).not.toEqual([]);
    const missing = structuredClone(vocabulary);
    missing[0]!.entries.pop();
    expect(validateEverydayContent(missing)).not.toEqual([]);
    const duplicate = structuredClone(vocabulary);
    duplicate[1]!.entries[0]!.sv = duplicate[0]!.entries[0]!.sv;
    expect(validateEverydayContent(duplicate)).not.toEqual([]);
    const malformed = structuredClone(vocabulary);
    malformed[0]!.entries[0]!.inflectionClass = 'IV';
    expect(validateEverydayContent(malformed)).not.toEqual([]);
  });

  it('shows the article and class inline in both directions and retains irregular forms', () => {
    const book = cards.find(card => card.sv === 'bok')!;
    expect(cardSides(book, 'fi-sv')).toEqual({ front: 'kirja', back: 'en bok 3' });
    expect(cardSides(book, 'sv-fi')).toEqual({ front: 'en bok 3', back: 'kirja' });
    expect(book.inflection).toBe('boken, böcker, böckerna');
    expect(cardSides(cards.find(card => card.sv === 'läsa')!, 'fi-sv').back).toBe('läsa II');
    expect(cardSides(cards.find(card => card.sv === 'i')!, 'fi-sv').back).toBe('i');
    expect(cards.find(card => card.sv === 'vatten')).toMatchObject({ article: 'ett', inflection: 'vattnet; tavallisesti yksikössä' });
    expect(cards.find(card => card.sv === 'vatten')!.inflectionClass).toBeUndefined();
    expect(cards.find(card => card.sv === 'finger')).toMatchObject({ article: 'ett', inflectionClass: '2' });
  });

  it('uses the exam new-round rule with fresh and previous cards without mixing collections', () => {
    const options = { sessionId: 'everyday-first', mode: 'lucky' as const, answerMode: 'cards' as const, direction: 'fi-sv' as const, requestedAmount: 25 as const };
    const first = createSession(cards, options, 1, seededRandom(10));
    const next = createNewRoundSession(cards, first, 'everyday-next', 2, seededRandom(20), { mixPreviousRound: true });
    expect(next.selectedCardIds.filter(id => first.selectedCardIds.includes(id))).toHaveLength(6);
    expect(next.selectedCardIds.filter(id => !first.selectedCardIds.includes(id))).toHaveLength(19);
    expect(new Set(next.selectedCardIds).size).toBe(25);
    const all = createSession(cards, { ...options, requestedAmount: 'all' }, 1, seededRandom(30));
    const allNext = createNewRoundSession(cards, all, 'everyday-all-next', 2, seededRandom(40), { mixPreviousRound: true });
    expect(new Set(allNext.selectedCardIds)).toEqual(new Set(all.selectedCardIds));
    expect(allNext.selectedCardIds).not.toEqual(all.selectedCardIds);
  });

  it('keeps both review pools scoped to everyday IDs even with medical mistakes stored', () => {
    const ids = [cards[0]!.id, examCardPayload[0]!.id, flashcardPayload[0]!.id];
    const stats: WordStatsStateV1 = { schemaVersion: 1, cards: Object.fromEntries(ids.map(id => [id, { attempts: 3, incorrect: 3, correctStreak: 0, lastAttemptAt: 100, lastIncorrectAt: 100 }])) };
    expect(selectWeakCards(stats, cards, 500).map(card => card.id)).toEqual([cards[0]!.id]);
    expect(selectDifficultCardIds(stats, new Set(cards.map(card => card.id)))).toEqual([cards[0]!.id]);
  });

  it('creates a separate 50-question test spanning every topic in both directions', () => {
    const byId = new Map(everydayTestTerms.map(term => [term.id, term]));
    const session = createExamTest(everydayTestTerms, 'everyday-test', 100, seededRandom(100));
    expect(isStoredExamTest(session, byId, session.sessionId)).toBe(true);
    expect(new Set(session.questions.map(question => question.termId)).size).toBe(50);
    for (const direction of ['fi-sv', 'sv-fi']) {
      const questions = session.questions.filter(question => question.direction === direction);
      expect(questions).toHaveLength(25);
      expect(new Set(questions.flatMap(question => byId.get(question.termId)!.topicIds)).size).toBe(20);
    }
    session.answers = session.questions.map(question => {
      const term = byId.get(question.termId)!;
      return question.direction === 'fi-sv' ? term.sv : term.fi;
    });
    expect(gradeExamTest(session, byId).total).toBe(100);
    const book = everydayTestTerms.find(term => term.fi === 'kirja')!;
    expect(scoreExamTestAnswer(book, 'fi-sv', 'en bok').points).toBe(1);
    expect(scoreExamTestAnswer(book, 'fi-sv', 'en bok 3').points).toBe(2);
    const eye = everydayTestTerms.find(term => term.fi === 'silmä')!;
    expect(scoreExamTestAnswer(eye, 'fi-sv', 'ett öga 4').points).toBe(2);
  });
});
