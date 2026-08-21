import { describe, expect, it } from 'vitest';
import { normalizeCanonical, validateContent } from '../../scripts/validate-content';
import type { Deck, DescriptionCategory, DescriptionExercise, Flashcard } from '../../src/types/content';

const deck: Deck = { id: 'd', nameFi: 'D', status: 'published' };
const card: Flashcard = {
  id: 'c', deckId: 'd', fi: 'maksa', sv: 'lever', partOfSpeech: 'noun', status: 'published',
};
const category: DescriptionCategory = { id: 'category', nameFi: 'Kategoria', status: 'published' };
const descriptions = Array.from({ length: 40 }, (_, index): DescriptionExercise => ({
  id: `q${index}`, categoryId: 'category', descriptionSv: 'Vilket organ beskrivs?', answerSv: `svar${index}`, status: 'published',
}));
const errorsFor = (
  cards: unknown[] = [card],
  items: unknown[] = descriptions,
  decks: unknown[] = [deck],
  categories: unknown[] = [category],
) => validateContent(decks, cards, items, categories);

describe('strict content validation', () => {
  it('accepts a minimal well-formed set', () => expect(errorsFor()).toEqual([]));

  it('rejects unknown properties on every content object', () => {
    expect(errorsFor([card], descriptions, [{ ...deck, extra: true }]).some((error) => error.includes('unknown deck properties'))).toBe(true);
    expect(errorsFor([{ ...card, extra: true }]).some((error) => error.includes('unknown flashcard properties'))).toBe(true);
    expect(errorsFor([card], [{ ...descriptions[0], extra: true }, ...descriptions.slice(1)]).some((error) => error.includes('unknown description properties'))).toBe(true);
    expect(errorsFor([card], descriptions, [deck], [{ ...category, extra: true }]).some((error) => error.includes('unknown description category properties'))).toBe(true);
  });

  it('rejects unknown categories and published descriptions in unpublished categories', () => {
    const unknown = [{ ...descriptions[0], categoryId: 'missing' }, ...descriptions.slice(1)];
    expect(errorsFor([card], unknown).some((error) => error.includes('unknown description category'))).toBe(true);
    expect(errorsFor([card], descriptions, [deck], [{ ...category, status: 'review' }]).some((error) => error.includes('unpublished category'))).toBe(true);
  });

  it('rejects duplicate IDs, canonical pairs, and bidirectional ambiguity', () => {
    const duplicatePair = { ...card, id: 'c2' };
    const ambiguousFi = { ...card, id: 'c3', sv: 'hepar' };
    const ambiguousSv = { ...card, id: 'c4', fi: 'maksakudos' };
    const errors = errorsFor([card, { ...card }, duplicatePair, ambiguousFi, ambiguousSv]);
    expect(errors.some((error) => error.includes('duplicate flashcard ID'))).toBe(true);
    expect(errors.some((error) => error.includes('duplicate canonical pair'))).toBe(true);
    expect(errors.some((error) => error.includes('Finnish term maps to multiple'))).toBe(true);
    expect(errors.some((error) => error.includes('Swedish term maps to multiple'))).toBe(true);
  });

  it('normalizes Unicode, case, and surrounding whitespace for uniqueness', () => {
    expect(normalizeCanonical('  SYDA\u0308N  ', 'fi')).toBe('sydän');
    const first = { ...card, id: 'c1', fi: 'sydän', sv: 'hjärta' };
    const second = { ...card, id: 'c2', fi: 'SYDA\u0308N', sv: 'HJÄRTA' };
    expect(errorsFor([first, second]).some((error) => error.includes('duplicate canonical pair'))).toBe(true);
  });

  it('enforces one-word terms while allowing hyphenated compounds', () => {
    const phrase = { ...card, id: 'phrase', fi: 'sydän lihas', sv: 'hjärtmuskel' };
    const compound = { ...card, id: 'compound', fi: 'tehohoito-osasto', sv: 'intensivvårdsavdelning' };
    expect(errorsFor([phrase]).some((error) => error.includes('not one lexical item'))).toBe(true);
    expect(errorsFor([compound])).toEqual([]);
  });

  it('requires separated valid articles only on nouns', () => {
    const embedded = { ...card, id: 'embedded', sv: 'en lever' };
    const adjectiveArticle = { ...card, id: 'adjective', sv: 'svettig', article: 'en', partOfSpeech: 'adjective' };
    const invalidArticle = { ...card, id: 'article', article: 'den' };
    expect(errorsFor([embedded]).some((error) => error.includes('article embedded'))).toBe(true);
    expect(errorsFor([adjectiveArticle]).some((error) => error.includes('article on non-noun'))).toBe(true);
    expect(errorsFor([invalidArticle]).some((error) => error.includes('invalid article'))).toBe(true);
  });

  it('enforces the closed part-of-speech values and valid inflection strings', () => {
    const missing = { ...card } as Record<string, unknown>; delete missing.partOfSpeech;
    const invalid = { ...card, id: 'invalid', partOfSpeech: 'participle' };
    const malformed = { ...card, id: 'inflection', inflection: 'form1 / form2' };
    expect(errorsFor([missing, invalid]).filter((error) => error.includes('part of speech'))).toHaveLength(2);
    expect(errorsFor([malformed]).some((error) => error.includes('malformed inflection'))).toBe(true);
  });

  it('rejects malformed description answers, synonyms, duplicates, and Finnish answers', () => {
    const malformed = { ...descriptions[0], answerSv: 'lever / hepar' };
    const synonym = { ...descriptions[1], answerSv: 'lever', acceptedInflections: ['hepar'] };
    const repeated = { ...descriptions[2], answerSv: 'lever', acceptedInflections: ['levern', 'LEVERN', 'lever'] };
    const finnish = { ...descriptions[3], answerSv: 'maksa' };
    const items = [malformed, synonym, repeated, finnish, ...descriptions.slice(4)];
    const errors = errorsFor([card], items);
    expect(errors.some((error) => error.includes('multiple description answers'))).toBe(true);
    expect(errors.some((error) => error.includes('not a grammatical form'))).toBe(true);
    expect(errors.some((error) => error.includes('duplicate accepted inflection'))).toBe(true);
    expect(errors.some((error) => error.includes('canonical answer repeated'))).toBe(true);
    expect(errors.some((error) => error.includes('Finnish canonical answer'))).toBe(true);
  });

  it('rejects fewer than 40 published description exercises', () => {
    expect(errorsFor([card], descriptions.slice(0, 39)).some((error) => error.includes('fewer than 40'))).toBe(true);
  });
});
