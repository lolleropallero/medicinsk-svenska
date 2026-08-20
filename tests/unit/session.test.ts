import { describe, expect, it } from 'vitest';
import { addGrade, cardSides, luckySelection, retryMissed, revealState, seededRandom, summary } from '../../src/lib/session';
import type { Flashcard } from '../../src/types/content';

const card = (n: number): Flashcard => ({ id:`c${n}`,deckId:'d',fi:`fi${n}`,sv:`sv${n}`,article:'en',status:'published',source:{document:'x.pdf',page:1} });
describe('flashcard sessions', () => {
  it('selects the correct card sides in both directions', () => {
    expect(cardSides(card(1),'fi-sv')).toMatchObject({front:'fi1',back:'en sv1'});
    expect(cardSides(card(1),'sv-fi')).toMatchObject({front:'en sv1',back:'fi1'});
  });
  it('moves an unrevealed card into the revealed grading state',()=>expect(revealState(false)).toEqual({revealed:true,canGrade:true}));
  it('records self-assessment and calculates a summary', () => {
    let grades = addGrade([], 'c1', true); grades = addGrade(grades, 'c2', false);
    expect(summary(grades)).toEqual({total:2,correct:1,missed:1,percentage:50});
    expect(retryMissed([card(1),card(2)], grades).map(c=>c.id)).toEqual(['c2']);
  });
  it('replaces an existing grade during state transitions', () => expect(addGrade([{cardId:'c1',correct:false}],'c1',true)).toEqual([{cardId:'c1',correct:true}]));
  it('returns 50 unique published cards from a larger pool', () => {
    const chosen = luckySelection(Array.from({length:70},(_,i)=>card(i)),50,seededRandom(4));
    expect(chosen).toHaveLength(50); expect(new Set(chosen.map(c=>c.id)).size).toBe(50);
  });
  it('returns every unique card when fewer than 50 exist', () => expect(luckySelection(Array.from({length:12},(_,i)=>card(i)),50,seededRandom(2))).toHaveLength(12));
  it('is deterministic with an injected seeded source', () => {
    const items=Array.from({length:60},(_,i)=>card(i));
    expect(luckySelection(items,50,seededRandom(9)).map(c=>c.id)).toEqual(luckySelection(items,50,seededRandom(9)).map(c=>c.id));
  });
  it('deduplicates identities and excludes unpublished cards', () => {
    const duplicate=card(1); const review={...card(2),status:'review' as const};
    expect(luckySelection([duplicate,duplicate,review],50,seededRandom(1)).map(c=>c.id)).toEqual(['c1']);
  });
});
