import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { examCardPayload, examTopics } from '../../src/lib/exam-content';
import { flashcardPayload } from '../../src/lib/content';
import { validateExamContent } from '../../scripts/validate-content';

describe('exam vocabulary import', () => {
  it('preserves the curated source entries, including notation and repeated words across topics', () => {
    expect(examTopics.map((topic) => topic.entries.length)).toEqual([136, 138, 47, 70, 49, 78]);
    expect(examTopics.map((topic) => createHash('sha256').update(JSON.stringify(topic.entries)).digest('hex'))).toEqual([
      '42c952c861a191bb7fb81b583f108546e6dbf60fed47d24af143ea3523a01d03',
      '8658c072802d33e0dc65137d1f218076c56dbe3379f539e4c26e51e0e9144f33',
      'dcd1cb0663f57851468c9ed2c65dbba26836451c5f3e7370a96397301afbff69',
      'cbc8e5a2f1d87af33b3335fe8aa8c3dd7cf571e473d6ebbd7e3dde31a657adc5',
      '705559fc8e1df7feba2c6dd34507d315ce131634e19a66c1eb67b4fb3e35f46c',
      'a3341c2f41443f0717e3dcf49cb00ff74e5dd73375cdd27ac22733cdb94b1b61',
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
      ['tentti-tutkiminen-012', 'kaula', 'en hals'],
    ]) {
      expect(byId.get(`tenttisanasto-${id}`)).toMatchObject({ fi, sv });
    }
  });

  it('uses the opposite source orientation for anatomy and shares its replacement with general practice', () => {
    expect(examCardPayload[0]).toMatchObject({ fi: 'pää', sv: 'ett huvud 5' });
    expect(examCardPayload.find((card) => card.deckId === 'tentti-epikriisi')).toMatchObject({ fi: 'hoitoaika', sv: 'vårdtid, -en' });
    const anatomy = examCardPayload.filter((card) => card.deckId === 'anatomi');
    expect(flashcardPayload.filter((card) => card.deckId === 'anatomi')).toEqual(anatomy);
    expect(flashcardPayload.some((card) => /^anatomi-\d/u.test(card.id))).toBe(false);
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
