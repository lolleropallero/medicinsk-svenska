import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import decksData from '../../content/decks.json';
import cardsData from '../../content/flashcards.json';
import descriptionsData from '../../content/descriptions.json';
import categoriesData from '../../content/description-categories.json';
import type { Flashcard } from '../../src/types/content';

const cards = cardsData as Flashcard[];
const originalCards = cards.slice(0, 373);
const newCards = cards.slice(373);
const byId = new Map(cards.map((card) => [card.id, card]));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const allowedTargets = new Set(['vastaanotto-anamneesi', 'tutkimukset-hoito', 'avdelningar']);
const roles = new Set([
  'sjukskötare', 'sjuksköterska', 'närvårdare', 'primärskötare', 'överskötare',
  'avdelningsskötare', 'vårdare', 'socialarbetare', 'hemvårdare', 'barnskötare',
]);
const locationIds = new Set([
  'osastot-behandlingsavdelning', 'osastot-foretagshalsovardsstation',
  'osastot-giftinformationscentral', 'osastot-halsostation', 'osastot-horcentral',
]);
const slug = (value: string) => value.normalize('NFD').replace(/\p{Mark}/gu, '').toLocaleLowerCase('sv').replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');

describe('physician vocabulary expansion', () => {
  it('publishes the two exact, non-empty new decks', () => {
    expect(decksData.map((deck) => deck.id)).toEqual([
      'anatomi', 'sjukdomar', 'forsta-hjalpen', 'mediciner', 'avdelningar',
      'vastaanotto-anamneesi', 'tutkimukset-hoito',
    ]);
    expect(decksData.filter((deck) => deck.id === 'vastaanotto-anamneesi')).toEqual([
      { id: 'vastaanotto-anamneesi', nameFi: 'Vastaanotto ja anamneesi', status: 'published' },
    ]);
    expect(decksData.filter((deck) => deck.id === 'tutkimukset-hoito')).toEqual([
      { id: 'tutkimukset-hoito', nameFi: 'Tutkimukset ja hoito', status: 'published' },
    ]);
    expect(cards.filter((card) => card.deckId === 'vastaanotto-anamneesi')).toHaveLength(27);
    expect(cards.filter((card) => card.deckId === 'tutkimukset-hoito')).toHaveLength(50);
  });

  it('preserves every accepted card and all description semantics byte-for-byte', () => {
    expect(originalCards).toHaveLength(373);
    expect(digest(originalCards)).toBe('ddf623c5d6208f94559af414ee187fec3094c72998760ef3ef26c9bbac740432');
    expect(digest(descriptionsData)).toBe('b5f3181fd61e64a22587035313eea58afd3d10432945f09def19fee1446b28e9');
    expect(digest(categoriesData)).toBe('76758a3761dccd174fd40805e5873dd42b2bde6e78616928f731e7609dd43362');
  });

  it('keeps every new item one-word, typed, unique, and in an allowed target', () => {
    expect(newCards).toHaveLength(82);
    expect(newCards.every((card) => allowedTargets.has(card.deckId))).toBe(true);
    expect(newCards.every((card) => !/\s|\//u.test(card.fi) && !/\s|\//u.test(card.sv))).toBe(true);
    expect(newCards.every((card) => ['noun', 'verb', 'adjective', 'adverb', 'other'].includes(card.partOfSpeech))).toBe(true);
    expect(newCards.every((card) => card.article === undefined || card.partOfSpeech === 'noun')).toBe(true);
    expect(newCards.every((card) => !/^(?:en|ett)\s/iu.test(card.sv))).toBe(true);
    expect(new Set(cards.map((card) => card.fi.normalize('NFC').toLocaleLowerCase('fi'))).size).toBe(cards.length);
    expect(new Set(cards.map((card) => card.sv.normalize('NFC').toLocaleLowerCase('sv'))).size).toBe(cards.length);
    expect(new Set(cards.map((card) => `${card.fi.normalize('NFC')}\0${card.sv.normalize('NFC')}`)).size).toBe(cards.length);
  });

  it('uses deterministic semantic IDs and excludes role vocabulary', () => {
    for (const card of newCards) {
      const prefix = card.deckId === 'avdelningar' ? 'osastot-' : `${card.deckId}-`;
      expect(card.id).toBe(`${prefix}${slug(card.sv)}`);
      expect(roles.has(card.sv.toLocaleLowerCase('sv'))).toBe(false);
    }
    expect(newCards.filter((card) => card.deckId === 'avdelningar').map((card) => card.id).sort()).toEqual([...locationIds].sort());
  });

  it.each([
    ['vastaanotto-anamneesi-anamnes', { fi: 'esitiedot', sv: 'anamnes', article: 'en', partOfSpeech: 'noun' }],
    ['vastaanotto-anamneesi-patientjournal', { fi: 'sairauskertomus', sv: 'patientjournal' }],
    ['tutkimukset-hoito-datortomografi', { fi: 'tietokonetomografia', sv: 'datortomografi' }],
    ['tutkimukset-hoito-stralbehandling', { fi: 'sädehoito', sv: 'strålbehandling' }],
    ['tutkimukset-hoito-rehabilitera', { fi: 'kuntouttaa', sv: 'rehabilitera', partOfSpeech: 'verb' }],
    ['tutkimukset-hoito-patientcentrerad', { fi: 'potilaskeskeinen', sv: 'patientcentrerad', partOfSpeech: 'adjective' }],
    ['vastaanotto-anamneesi-urinprov', { fi: 'virtsanäyte', sv: 'urinprov', article: 'ett', inflection: 'urinprovet, urinprov, urinproven' }],
    ['osastot-giftinformationscentral', { fi: 'myrkytystietokeskus', sv: 'giftinformationscentral', article: 'en' }],
  ])('contains representative curated card %s', (id, fields) => {
    expect(byId.get(id)).toMatchObject(fields);
  });
});
