import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { examCardPayload, examTopics } from '../../src/lib/exam-content';
import { flashcardPayload } from '../../src/lib/content';
import { validateExamContent } from '../../scripts/validate-content';
import { swedishExamAnswers, swedishLexicalKey } from '../../src/lib/exam-test-answers';

describe('exam vocabulary import', () => {
  it('preserves the curated source entries, including notation and repeated words across topics', () => {
    expect(examTopics.map((topic) => topic.entries.length)).toEqual([136, 138, 47, 70, 49, 78]);
    expect(examTopics.map((topic) => createHash('sha256').update(JSON.stringify(topic.entries)).digest('hex'))).toEqual([
      '43f9c2226573657e8899365f813bb4ea8ba8cb4577858547a38464c06e371af2',
      '7beebab101412bb4b6cc7be9cc7930435f2cb700cb58c5029ecf763bc215472e',
      '3453d6f8011af01f9a48f93c3e27926e1efe0b259dfe6e6e53ee72b9a88c1851',
      '690ffda6217dfee6dd09d4c6cdad05fd0c1b9c810ada8abc03c8c158d47548ec',
      '2ef4879881fdc42afb46ca3c725f682c0286554a1e6199afd64ead0616c0bc1e',
      '30c8b05c2cb33011056d5f19e29ff80939bdaf553d00f6d48d774598e4db6ba6',
    ]);
    expect(examCardPayload).toHaveLength(518);
    expect(new Set(examCardPayload.map((card) => card.id)).size).toBe(518);
    expect(examCardPayload.every((card) => card.selfAssessmentOnly)).toBe(true);
    expect(examCardPayload.every((card) => !('sourceFile' in card) && !('status' in card))).toBe(true);
  });

  it('keeps saved card IDs attached to the same words after removing synonyms', () => {
    const byId = new Map(examCardPayload.map((card) => [card.id, card]));
    for (const id of ['anatomi-132', 'tentti-sydansairaudet-004', 'tentti-sydansairaudet-044', 'tentti-tutkiminen-011']) {
      expect(byId.has(`tenttisanasto-${id}`)).toBe(false);
    }
    for (const [id, fi, sv] of [
      ['anatomi-133', 'verisuoni', 'ett blodkärl 5'],
      ['tentti-sydansairaudet-005', 'sydänäänet', 'hjärttoner, -na'],
      ['tentti-sydansairaudet-045', 'määrätä lääkkeitä jllkn', 'skriva IV ut mediciner åt ngn'],
      ['tentti-tutkiminen-012', 'kaula', 'en hals 2'],
    ]) {
      expect(byId.get(`tenttisanasto-${id}`)).toMatchObject({ fi, sv });
    }
  });

  it('uses the opposite source orientation for anatomy and shares its replacement with general practice', () => {
    expect(examCardPayload[0]).toMatchObject({ fi: 'pää', sv: 'ett huvud 5' });
    expect(examCardPayload.find((card) => card.deckId === 'tentti-epikriisi')).toMatchObject({ fi: 'hoitoaika', sv: 'vårdtid, -en 3' });
    const anatomy = examCardPayload.filter((card) => card.deckId === 'anatomi');
    expect(flashcardPayload.filter((card) => card.deckId === 'anatomi')).toEqual(anatomy);
    expect(flashcardPayload.some((card) => /^anatomi-\d/u.test(card.id))).toBe(false);
  });

  it('uses the same listed class for repeated single-word Swedish terms in every topic', () => {
    const classesByTerm = new Map<string, Set<string>>();
    for (const card of examCardPayload) {
      for (const answer of swedishExamAnswers(card.sv)) {
        const key = swedishLexicalKey(answer);
        // Original phrase classes are retained, but no new ones are added to phrases.
        if (key.includes(' ')) continue;
        const classes = classesByTerm.get(key) ?? new Set<string>();
        classes.add(answer.match(/\b(?:[1-5]|I{1,3}|IV)\b/u)?.[0] ?? 'unlisted');
        classesByTerm.set(key, classes);
      }
    }
    for (const [term, classes] of classesByTerm) expect([...classes], term).toHaveLength(1);
  });

  it('rejects missing lists, swapped languages and malformed source entries', () => {
    expect(validateExamContent(examTopics)).toEqual([]);
    expect(validateExamContent(examTopics.slice(1))).not.toEqual([]);
    expect(validateExamContent([{ ...examTopics[0], swedishField: 'definition' }, ...examTopics.slice(1)])).not.toEqual([]);
    const topics = structuredClone(examTopics);
    topics[0]!.entries[0]!.term = '';
    expect(validateExamContent(topics)).not.toEqual([]);
  });
});
