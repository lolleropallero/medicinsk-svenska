import { describe, expect, it } from 'vitest';
import { anamnesisCasePayload, deckPayload, descriptionCategoryPayload, descriptionPayload, flashcardPayload, phraseCategoryPayload, phrasePayload } from '../../src/lib/content';

const keys = (value: object) => Object.keys(value).sort();

describe('explicit client payload projections', () => {
  it('allows only flashcard application fields', () => {
    const allowed = new Set(['id', 'deckId', 'fi', 'sv', 'article', 'partOfSpeech', 'inflection']);
    expect(flashcardPayload).toHaveLength(498);
    expect(flashcardPayload.every((card) => keys(card).every((key) => allowed.has(key)))).toBe(true);
  });

  it('allows only description application fields', () => {
    const allowed = new Set(['id', 'categoryId', 'descriptionSv', 'answerSv', 'acceptedInflections', 'article', 'inflection']);
    expect(descriptionPayload).toHaveLength(51);
    expect(descriptionPayload.every((item) => keys(item).every((key) => allowed.has(key)))).toBe(true);
  });

  it('allows only description category application fields', () => {
    expect(descriptionCategoryPayload).toHaveLength(7);
    expect(descriptionCategoryPayload.every((item) => keys(item).every((key) => ['id', 'nameFi'].includes(key)))).toBe(true);
  });

  it('allows only deck application fields', () => {
    expect(deckPayload).toHaveLength(8);
    expect(deckPayload.every((deck) => keys(deck).every((key) => ['id', 'nameFi'].includes(key)))).toBe(true);
  });

  it('allows only phrase application fields', () => {
    expect(phrasePayload).toHaveLength(73);
    expect(phrasePayload.every((item) => keys(item).every((key) => ['id', 'categoryId', 'fi', 'sv'].includes(key)))).toBe(true);
    expect(phraseCategoryPayload).toHaveLength(3);
    expect(phraseCategoryPayload.every((item) => keys(item).every((key) => ['id', 'nameFi'].includes(key)))).toBe(true);
  });

  it('allows only anamnesis case application fields, including nested sections and items', () => {
    const allowed = new Set(['id', 'nameFi', 'sections']);
    const sectionAllowed = new Set(['id', 'nameFi', 'items']);
    const itemAllowed = new Set(['id', 'patientSv', 'modelQuestionsSv']);
    expect(anamnesisCasePayload).toHaveLength(1);
    expect(anamnesisCasePayload.every((item) => keys(item).every((key) => allowed.has(key)))).toBe(true);
    expect(anamnesisCasePayload.every((item) => item.sections.every((section) => keys(section).every((key) => sectionAllowed.has(key))))).toBe(true);
    expect(anamnesisCasePayload.every((item) => item.sections.every((section) => section.items.every((entry) => keys(entry).every((key) => itemAllowed.has(key)))))).toBe(true);
  });
});
