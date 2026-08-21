import { describe, expect, it } from 'vitest';
import { deckPayload, descriptionPayload, flashcardPayload } from '../../src/lib/content';

const keys = (value: object) => Object.keys(value).sort();

describe('explicit client payload projections', () => {
  it('allows only flashcard application fields', () => {
    const allowed = new Set(['id', 'deckId', 'fi', 'sv', 'article', 'partOfSpeech', 'inflection']);
    expect(flashcardPayload).toHaveLength(373);
    expect(flashcardPayload.every((card) => keys(card).every((key) => allowed.has(key)))).toBe(true);
  });

  it('allows only description application fields', () => {
    const allowed = new Set(['id', 'descriptionSv', 'answerSv', 'acceptedInflections', 'article', 'inflection']);
    expect(descriptionPayload).toHaveLength(51);
    expect(descriptionPayload.every((item) => keys(item).every((key) => allowed.has(key)))).toBe(true);
  });

  it('allows only deck application fields', () => {
    expect(deckPayload).toHaveLength(5);
    expect(deckPayload.every((deck) => keys(deck).every((key) => ['id', 'nameFi'].includes(key)))).toBe(true);
  });
});
