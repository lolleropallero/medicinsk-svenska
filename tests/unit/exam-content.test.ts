import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { examCardPayload, examTopics } from '../../src/lib/exam-content';
import { flashcardPayload } from '../../src/lib/content';
import { validateExamContent } from '../../scripts/validate-content';

describe('exam vocabulary import', () => {
  it('preserves every source entry, including notation and repeated words across topics', () => {
    expect(examTopics.map((topic) => topic.entries.length)).toEqual([137, 138, 49, 70, 50, 78]);
    expect(examTopics.map((topic) => createHash('sha256').update(JSON.stringify(topic.entries)).digest('hex'))).toEqual([
      '1114e519c63d558d276b96ca8d70b986b7a3c559ef6d0e9ced4e422e2b53bae3',
      '8658c072802d33e0dc65137d1f218076c56dbe3379f539e4c26e51e0e9144f33',
      'f6f6a5ab52fec6e28676a0fe5d4d09a2aab2bea48c4b2f896a6017aa2b529e45',
      'cbc8e5a2f1d87af33b3335fe8aa8c3dd7cf571e473d6ebbd7e3dde31a657adc5',
      '0a64654e09ad103e1f41750366eccea2a2b01770bf008c07ebbd67cd84d335ce',
      'a3341c2f41443f0717e3dcf49cb00ff74e5dd73375cdd27ac22733cdb94b1b61',
    ]);
    expect(examCardPayload).toHaveLength(522);
    expect(new Set(examCardPayload.map((card) => card.id)).size).toBe(522);
    expect(examCardPayload.every((card) => card.selfAssessmentOnly)).toBe(true);
    expect(examCardPayload.every((card) => !('sourceFile' in card) && !('status' in card))).toBe(true);
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
