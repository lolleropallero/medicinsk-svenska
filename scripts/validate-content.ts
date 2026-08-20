import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Deck, DescriptionExercise, Flashcard, PublicationStatus } from '../src/types/content';

const read = <T>(name: string) => JSON.parse(readFileSync(resolve('content', name), 'utf8')) as T;
const allowed = new Set<PublicationStatus>(['published', 'review', 'skipped']);
const alternativePattern = /\s[\/;]\s|\n|\s+(?:eller|tai)\s+/i;
const errors: string[] = [];
const assert = (condition: unknown, message: string) => { if (!condition) errors.push(message); };

export function validateContent(decks: Deck[], cards: Flashcard[], descriptions: DescriptionExercise[]): string[] {
  const found: string[] = [];
  const check = (condition: unknown, message: string) => { if (!condition) found.push(message); };
  const deckIds = new Set<string>();
  for (const deck of decks) {
    check(Boolean(deck.id), 'deck missing ID');
    check(!deckIds.has(deck.id), `duplicate deck ID: ${deck.id}`);
    deckIds.add(deck.id);
    check(allowed.has(deck.status), `invalid deck publication status: ${deck.id}`);
    check(Boolean(deck.nameFi && deck.descriptionFi && deck.sourceDocument), `incomplete deck: ${deck.id}`);
  }
  const ids = new Set<string>(), pairs = new Set<string>();
  for (const card of cards) {
    check(Boolean(card.id), 'flashcard missing ID');
    check(!ids.has(card.id), `duplicate flashcard ID: ${card.id}`); ids.add(card.id);
    check(deckIds.has(card.deckId), `unknown deck ID on ${card.id}: ${card.deckId}`);
    check(Boolean(card.fi.trim() && card.sv.trim()), `empty term on ${card.id}`);
    check(!alternativePattern.test(card.fi) && !alternativePattern.test(card.sv), `multiple alternatives on ${card.id}`);
    check(!card.fi.includes('/') && !card.sv.includes('/'), `slash-separated term on ${card.id}`);
    check(!card.fi.includes('\n') && !card.sv.includes('\n'), `newline in term on ${card.id}`);
    check(!/\s/.test(card.fi.trim()) && !/\s/.test(card.sv.trim()), `term is not one lexical item on ${card.id}`);
    check(allowed.has(card.status), `invalid card publication status: ${card.id}`);
    const pair = `${card.fi.toLocaleLowerCase('fi')}\0${card.sv.toLocaleLowerCase('sv')}`;
    check(!pairs.has(pair), `duplicate canonical pair: ${card.id}`); pairs.add(pair);
    check(Boolean(card.source?.document && card.source.page > 0), `missing source metadata: ${card.id}`);
  }
  const descriptionIds = new Set<string>();
  for (const item of descriptions) {
    check(Boolean(item.id), 'description missing ID');
    check(!descriptionIds.has(item.id), `duplicate description ID: ${item.id}`); descriptionIds.add(item.id);
    check(Boolean(item.answerSv?.trim()), `missing description answer: ${item.id}`);
    check(Boolean(item.descriptionSv?.trim()), `missing Swedish description: ${item.id}`);
    check(!alternativePattern.test(item.answerSv), `multiple description answers: ${item.id}`);
    check(allowed.has(item.status), `invalid description publication status: ${item.id}`);
    check(Boolean(item.source?.document && item.source.page > 0 && item.source.section), `description missing source metadata: ${item.id}`);
  }
  check(descriptions.filter((item) => item.status === 'published').length >= 40, 'fewer than 40 published description exercises');
  const publishedIds = cards.filter((c) => c.status === 'published').map((c) => c.id);
  check(new Set(publishedIds).size === publishedIds.length, 'lucky-session pool contains duplicate identities');
  return found;
}

const decks = read<Deck[]>('decks.json'), cards = read<Flashcard[]>('flashcards.json'), descriptions = read<DescriptionExercise[]>('descriptions.json');
errors.push(...validateContent(decks, cards, descriptions));
assert(decks.filter((d) => d.status === 'published').length === 5, 'exactly five decks must be published');
if (errors.length) { console.error(errors.map((e) => `- ${e}`).join('\n')); process.exit(1); }
console.log(`Content valid: ${decks.length} decks, ${cards.length} cards, ${descriptions.length} descriptions.`);
