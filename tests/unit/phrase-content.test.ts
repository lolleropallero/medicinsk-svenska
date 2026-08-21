import { describe, expect, it } from 'vitest';
import categories from '../../content/phrase-categories.json';
import phrases from '../../content/phrases.json';
import flashcards from '../../content/flashcards.json';
import { validatePhraseContent } from '../../scripts/validate-content';

describe('clinical phrase content', () => {
  it('has the three exact non-empty categories', () => {
    expect(categories.map(({ id, nameFi }) => ({ id, nameFi }))).toEqual([
      { id: 'taustatiedot', nameFi: 'Taustatiedot' },
      { id: 'oireet-vointi', nameFi: 'Oireet ja vointi' },
      { id: 'hoito-laakitys', nameFi: 'Hoito ja lääkitys' },
    ]);
    expect(Object.fromEntries(categories.map((category) => [category.id, phrases.filter((phrase) => phrase.categoryId === category.id).length])))
      .toEqual({ taustatiedot: 7, 'oireet-vointi': 20, 'hoito-laakitys': 46 });
  });

  it('validates all phrase content and preserves unique canonical sides', () => {
    expect(validatePhraseContent(categories, phrases)).toEqual([]);
    expect(new Set(phrases.map((phrase) => phrase.fi.normalize('NFKC').toLocaleLowerCase('fi'))).size).toBe(phrases.length);
    expect(new Set(phrases.map((phrase) => phrase.sv.normalize('NFKC').toLocaleLowerCase('sv'))).size).toBe(phrases.length);
  });

  it('uses semantic IDs that match each category', () => {
    expect(phrases.every((phrase) => phrase.id.startsWith(`fraasi-${phrase.categoryId}-`))).toBe(true);
    const invalid = { ...phrases[0], id: 'fraasi-hoito-laakitys-wrong-category' };
    expect(validatePhraseContent(categories, [invalid, ...phrases.slice(1)])
      .some((error) => error.includes('does not match category'))).toBe(true);
  });

  it('keeps phrase learning units out of one-word flashcard data', () => {
    expect(flashcards.some((card) => card.id.startsWith('fraasi-'))).toBe(false);
    expect(flashcards.every((card) => !Object.hasOwn(card, 'categoryId'))).toBe(true);
  });

  it('rejects unknown and source-like keys', () => {
    expect(validatePhraseContent([{ ...categories[0], extra: true }, ...categories.slice(1)], phrases)
      .some((error) => error.includes('unknown phrase category properties'))).toBe(true);
    expect(validatePhraseContent(categories, [{ ...phrases[0], source: 'hidden' }, ...phrases.slice(1)])
      .some((error) => error.includes('unknown phrase properties'))).toBe(true);
  });

  it.each([
    ['slash', { ...phrases[0], sv: 'Hej / god dag' }],
    ['semicolon', { ...phrases[0], sv: 'Hej; god dag' }],
    ['ellipsis', { ...phrases[0], sv: 'När är ni...' }],
    ['placeholder', { ...phrases[0], sv: 'Ta X tabletter' }],
    ['repeated whitespace', { ...phrases[0], sv: 'Hur  mår ni?' }],
  ])('rejects %s content', (_label, invalid) => {
    expect(validatePhraseContent(categories, [invalid, ...phrases.slice(1)]).length).toBeGreaterThan(0);
  });

  it('rejects duplicate Finnish, Swedish, and pair variants even when punctuation differs', () => {
    const duplicate = { ...phrases[0], id: 'fraasi-taustatiedot-duplicate', sv: `${phrases[0]!.sv.slice(0, -1)}!` };
    const errors = validatePhraseContent(categories, [...phrases, duplicate]);
    expect(errors.some((error) => error.includes('duplicate normalized Finnish phrase'))).toBe(true);
    expect(errors.some((error) => error.includes('duplicate normalized Swedish phrase'))).toBe(true);
  });
});
