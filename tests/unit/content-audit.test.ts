import { describe, expect, it } from 'vitest';
import cardsData from '../../content/flashcards.json';
import descriptionsData from '../../content/descriptions.json';
import categoriesData from '../../content/description-categories.json';
import type { Flashcard, PartOfSpeech } from '../../src/types/content';

const cards = cardsData as Flashcard[];
const byId = new Map(cards.map((card) => [card.id, card]));
const allowedParts = new Set<PartOfSpeech>(['noun', 'verb', 'adjective', 'adverb', 'other']);

describe('audited learning content', () => {
  it('has the reconciled published card counts', () => {
    const counts = Object.fromEntries(
      ['anatomi', 'sjukdomar', 'forsta-hjalpen', 'mediciner', 'avdelningar'].map((deckId) => [
        deckId,
        cards.filter((card) => card.deckId === deckId && card.status === 'published').length,
      ]),
    );
    expect(counts).toEqual({ anatomi: 130, sjukdomar: 125, 'forsta-hjalpen': 56, mediciner: 49, avdelningar: 13 });
    expect(cards).toHaveLength(373);
  });

  it('contains the corrected reproductive anatomy pair and rhythm pair exactly once', () => {
    expect(cards.some((card) => card.fi === ['mona', 'torvi'].join(''))).toBe(false);
    expect(byId.get('anatomi-004')).toMatchObject({ fi: 'munanjohdin', sv: 'äggledare' });
    expect(cards.filter((card) => card.fi === 'rytmihäiriö' && card.sv === 'rytmstörning')).toHaveLength(1);
    expect(cards.some((card) => card.sv === ['rytmstör', 'nig'].join(''))).toBe(false);
  });

  it.each([
    ['anatomi-024', 'jalkaterä', 'fot', 'fötter, fötterna'],
    ['anatomi-033', 'käsi', 'hand', 'händer, händerna'],
    ['anatomi-083', 'hammas', 'tand', 'tänder, tänderna'],
  ])('restores %s with article and irregular forms', (id, fi, sv, inflection) => {
    expect(byId.get(id)).toMatchObject({ fi, sv, article: 'en', partOfSpeech: 'noun', inflection });
  });

  it('keeps finger as an ett noun with explicit forms', () => {
    expect(byId.get('anatomi-095')).toMatchObject({
      fi: 'sormi', sv: 'finger', article: 'ett', partOfSpeech: 'noun', inflection: 'fingret, fingrar, fingrarna',
    });
  });

  it('uses the medically current poisoning term and removes known malformed terms', () => {
    expect(byId.get('sjukdomar-091')).toMatchObject({ fi: 'häkämyrkytys', sv: 'kolmonoxidförgiftning' });
    const malformedTerms = [
      ['kolos', 'förgiftning'],
      ['en', 'hjärtkompression'],
      ['förlossnins', 'avdelning'],
      ['ex', 'rtra'],
      ['asy', 'atoli'],
    ].map((parts) => parts.join(''));
    for (const malformed of malformedTerms) {
      expect(cards.some((card) => card.fi === malformed || card.sv === malformed)).toBe(false);
    }
    expect(byId.get('forsta-hjalpen-018')).toMatchObject({ sv: 'hjärtkompression', article: 'en', partOfSpeech: 'noun' });
  });

  it.each([
    'forsta-hjalpen-006', 'forsta-hjalpen-050', 'forsta-hjalpen-058', 'forsta-hjalpen-062',
    'forsta-hjalpen-072', 'mediciner-005', 'mediciner-009', 'mediciner-052', 'mediciner-071',
    'mediciner-072', 'mediciner-076', 'mediciner-092', 'mediciner-095', 'mediciner-103',
    'mediciner-107', 'mediciner-108',
  ])('labels known adjective %s correctly', (id) => {
    expect(byId.get(id)?.partOfSpeech).toBe('adjective');
  });

  it('gives every published card a closed part of speech and counts retained forms', () => {
    expect(cards.every((card) => allowedParts.has(card.partOfSpeech))).toBe(true);
    expect(cards.filter((card) => card.inflection).length).toBe(7);
  });

  it('preserves all valid description exercises and grammatical accepted forms', () => {
    expect(descriptionsData).toHaveLength(51);
    expect(descriptionsData.find((item) => item.id === 'beskrivning-023')?.acceptedInflections).toEqual(['hjärtat']);
    expect(descriptionsData.find((item) => item.id === 'beskrivning-027')?.acceptedInflections).toEqual(['lungorna']);
    expect(descriptionsData.find((item) => item.id === 'beskrivning-036')?.acceptedInflections).toEqual(['mjälten']);
    expect(descriptionsData.find((item) => item.id === 'beskrivning-038')?.acceptedInflections).toEqual(['levern']);
  });

  it('assigns every description to one of seven non-empty categories with exact counts', () => {
    const publishedCategories = categoriesData.filter((category) => category.status === 'published');
    const ids = publishedCategories.map((category) => category.id);
    expect(new Set(ids).size).toBe(7);
    expect(descriptionsData.every((item) => ids.includes(item.categoryId))).toBe(true);
    expect(ids.map((id) => descriptionsData.filter((item) => item.categoryId === id).length)).toEqual([8, 7, 7, 8, 6, 7, 8]);
  });
});
