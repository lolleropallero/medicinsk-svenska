import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type RecordValue = Record<string, unknown>;

const publicationStatuses = new Set(['published', 'review', 'skipped']);
const partOfSpeechValues = new Set(['noun', 'verb', 'adjective', 'adverb', 'other']);
const articleValues = new Set(['en', 'ett']);
const deckKeys = new Set(['id', 'nameFi', 'status']);
const descriptionCategoryKeys = new Set(['id', 'nameFi', 'status']);
const cardKeys = new Set(['id', 'deckId', 'fi', 'sv', 'article', 'partOfSpeech', 'inflection', 'status']);
const descriptionKeys = new Set([
  'id', 'categoryId', 'descriptionSv', 'answerSv', 'acceptedInflections', 'article', 'inflection', 'status',
]);
const answerAlternativePattern = /[\/;\n]|\s+(?:eller|tai)\s+/iu;
const requiredExpansionDecks = new Map([
  ['vastaanotto-anamneesi', 'Vastaanotto ja anamneesi'],
  ['tutkimukset-hoito', 'Tutkimukset ja hoito'],
]);
const allowedDeckIds = new Set([
  'anatomi', 'sjukdomar', 'forsta-hjalpen', 'mediciner', 'avdelningar',
  'vastaanotto-anamneesi', 'tutkimukset-hoito',
]);
const expansionPrefixes = new Map([
  ['vastaanotto-anamneesi-', 'vastaanotto-anamneesi'],
  ['tutkimukset-hoito-', 'tutkimukset-hoito'],
  ['osastot-', 'avdelningar'],
]);
const excludedRoleTerms = new Set([
  'sjukskötare', 'sjuksköterska', 'närvårdare', 'primärskötare', 'överskötare',
  'avdelningsskötare', 'vårdare', 'socialarbetare', 'hemvårdare', 'barnskötare',
]);

const read = (name: string): unknown[] => JSON.parse(readFileSync(resolve('content', name), 'utf8')) as unknown[];
const isRecord = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string => typeof value === 'string' ? value : '';

export function normalizeCanonical(value: string, locale: 'fi' | 'sv'): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase(locale);
}

function hasValidInflection(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    value.length > 0 &&
    value.length <= 160 &&
    !/[\/\n\r]/u.test(value)
  );
}

function unknownKeys(value: RecordValue, allowed: ReadonlySet<string>): string[] {
  return Object.keys(value).filter((key) => !allowed.has(key));
}

function isGrammaticalForm(canonical: string, candidate: string): boolean {
  const base = normalizeCanonical(canonical, 'sv');
  const form = normalizeCanonical(candidate, 'sv');
  return form.length > base.length && form.startsWith(base);
}

export function validateContent(
  decksInput: unknown[],
  cardsInput: unknown[],
  descriptionsInput: unknown[],
  categoriesInput: unknown[],
): string[] {
  const errors: string[] = [];
  const check = (condition: unknown, message: string) => { if (!condition) errors.push(message); };

  const deckIds = new Set<string>();
  for (const raw of decksInput) {
    if (!isRecord(raw)) { errors.push('deck must be an object'); continue; }
    const id = text(raw.id);
    const extra = unknownKeys(raw, deckKeys);
    check(extra.length === 0, `unknown deck properties on ${id || '(missing ID)'}: ${extra.join(', ')}`);
    check(id.trim().length > 0, 'deck missing ID');
    check(!deckIds.has(id), `duplicate deck ID: ${id}`);
    if (id) deckIds.add(id);
    check(text(raw.nameFi).trim().length > 0, `deck missing name: ${id}`);
    check(publicationStatuses.has(text(raw.status)), `invalid deck publication status: ${id}`);
  }

  const categoryIds = new Set<string>();
  const publishedCategoryIds = new Set<string>();
  for (const raw of categoriesInput) {
    if (!isRecord(raw)) { errors.push('description category must be an object'); continue; }
    const id = text(raw.id);
    const status = text(raw.status);
    const extra = unknownKeys(raw, descriptionCategoryKeys);
    check(extra.length === 0, `unknown description category properties on ${id || '(missing ID)'}: ${extra.join(', ')}`);
    check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id), `invalid description category ID: ${id || '(missing ID)'}`);
    check(!categoryIds.has(id), `duplicate description category ID: ${id}`);
    if (id) categoryIds.add(id);
    check(text(raw.nameFi).trim().length > 0, `description category missing name: ${id}`);
    check(publicationStatuses.has(status), `invalid description category publication status: ${id}`);
    if (status === 'published') publishedCategoryIds.add(id);
  }

  const cardIds = new Set<string>();
  const pairs = new Set<string>();
  const finnishMappings = new Map<string, string>();
  const swedishMappings = new Map<string, string>();
  const publishedFinnish = new Set<string>();
  const publishedSwedish = new Set<string>();

  for (const raw of cardsInput) {
    if (!isRecord(raw)) { errors.push('flashcard must be an object'); continue; }
    const id = text(raw.id);
    const deckId = text(raw.deckId);
    const fi = text(raw.fi);
    const sv = text(raw.sv);
    const status = text(raw.status);
    const partOfSpeech = text(raw.partOfSpeech);
    const extra = unknownKeys(raw, cardKeys);

    check(extra.length === 0, `unknown flashcard properties on ${id || '(missing ID)'}: ${extra.join(', ')}`);
    check(id.trim().length > 0, 'flashcard missing ID');
    check(!cardIds.has(id), `duplicate flashcard ID: ${id}`);
    if (id) cardIds.add(id);
    check(deckIds.has(deckId), `unknown deck ID on ${id}: ${deckId}`);
    check(fi.trim().length > 0 && sv.trim().length > 0, `empty term on ${id}`);
    check(!fi.includes('\n') && !fi.includes('\r') && !sv.includes('\n') && !sv.includes('\r'), `newline in term on ${id}`);
    check(!fi.includes('/') && !sv.includes('/'), `slash-separated term on ${id}`);
    check(!/\s/u.test(fi.trim()) && !/\s/u.test(sv.trim()), `term is not one lexical item on ${id}`);
    check(!/^(?:en|ett)\s+/iu.test(sv.trim()), `article embedded in Swedish term on ${id}`);
    check(publicationStatuses.has(status), `invalid card publication status: ${id}`);
    check(partOfSpeechValues.has(partOfSpeech), `missing or invalid part of speech on ${id}`);
    if (raw.article !== undefined) {
      check(articleValues.has(text(raw.article)), `invalid article on ${id}`);
      check(partOfSpeech === 'noun', `article on non-noun card ${id}`);
    }
    if (raw.inflection !== undefined) check(hasValidInflection(raw.inflection), `malformed inflection on ${id}`);

    if (status === 'published' && fi.trim() && sv.trim()) {
      const normalizedFi = normalizeCanonical(fi, 'fi');
      const normalizedSv = normalizeCanonical(sv, 'sv');
      const pair = `${normalizedFi}\0${normalizedSv}`;
      check(!pairs.has(pair), `duplicate canonical pair: ${id}`);
      pairs.add(pair);
      const priorSv = finnishMappings.get(normalizedFi);
      check(priorSv === undefined || priorSv === normalizedSv, `Finnish term maps to multiple Swedish terms: ${fi}`);
      finnishMappings.set(normalizedFi, normalizedSv);
      const priorFi = swedishMappings.get(normalizedSv);
      check(priorFi === undefined || priorFi === normalizedFi, `Swedish term maps to multiple Finnish terms: ${sv}`);
      swedishMappings.set(normalizedSv, normalizedFi);
      publishedFinnish.add(normalizedFi);
      publishedSwedish.add(normalizedSv);
    }
  }

  const descriptionIds = new Set<string>();
  let publishedDescriptionCount = 0;
  const publishedCountByCategory = new Map<string, number>();
  for (const raw of descriptionsInput) {
    if (!isRecord(raw)) { errors.push('description exercise must be an object'); continue; }
    const id = text(raw.id);
    const description = text(raw.descriptionSv);
    const answer = text(raw.answerSv);
    const status = text(raw.status);
    const categoryId = text(raw.categoryId);
    const extra = unknownKeys(raw, descriptionKeys);

    check(extra.length === 0, `unknown description properties on ${id || '(missing ID)'}: ${extra.join(', ')}`);
    check(id.trim().length > 0, 'description missing ID');
    check(!descriptionIds.has(id), `duplicate description ID: ${id}`);
    if (id) descriptionIds.add(id);
    check(description.trim().length > 0, `empty description on ${id}`);
    check(answer.trim().length > 0, `empty canonical answer on ${id}`);
    check(!answerAlternativePattern.test(answer), `multiple description answers on ${id}`);
    check(publicationStatuses.has(status), `invalid description publication status: ${id}`);
    check(categoryIds.has(categoryId), `unknown description category on ${id}: ${categoryId}`);
    if (status === 'published') {
      publishedDescriptionCount += 1;
      check(publishedCategoryIds.has(categoryId), `published description uses unpublished category on ${id}: ${categoryId}`);
      publishedCountByCategory.set(categoryId, (publishedCountByCategory.get(categoryId) ?? 0) + 1);
    }
    if (raw.article !== undefined) check(articleValues.has(text(raw.article)), `invalid description article on ${id}`);
    if (raw.inflection !== undefined) check(hasValidInflection(raw.inflection), `malformed description inflection on ${id}`);

    const normalizedAnswer = normalizeCanonical(answer, 'sv');
    check(
      !publishedFinnish.has(normalizedAnswer) || publishedSwedish.has(normalizedAnswer),
      `Finnish canonical answer on ${id}`,
    );

    if (raw.acceptedInflections !== undefined) {
      check(Array.isArray(raw.acceptedInflections), `accepted inflections must be an array on ${id}`);
      if (Array.isArray(raw.acceptedInflections)) {
        const accepted = raw.acceptedInflections;
        const normalized = accepted.map((form) => normalizeCanonical(text(form), 'sv'));
        check(accepted.every((form) => typeof form === 'string' && form.trim().length > 0), `malformed accepted inflection on ${id}`);
        check(new Set(normalized).size === normalized.length, `duplicate accepted inflection on ${id}`);
        check(!normalized.includes(normalizedAnswer), `canonical answer repeated in accepted inflections on ${id}`);
        check(
          accepted.every((form) => typeof form === 'string' && isGrammaticalForm(answer, form)),
          `accepted answer is not a grammatical form on ${id}`,
        );
        check(
          normalized.every((form) => !publishedFinnish.has(form) || publishedSwedish.has(form)),
          `Finnish accepted answer on ${id}`,
        );
      }
    }
  }

  check(publishedDescriptionCount >= 40, 'fewer than 40 published description exercises');
  for (const categoryId of publishedCategoryIds) {
    check((publishedCountByCategory.get(categoryId) ?? 0) > 0, `published description category is empty: ${categoryId}`);
  }
  return errors;
}

const decks = read('decks.json');
const cards = read('flashcards.json');
const descriptions = read('descriptions.json');
const descriptionCategories = read('description-categories.json');
const errors = validateContent(decks, cards, descriptions, descriptionCategories);
const publishedDecks = decks.filter((deck) => isRecord(deck) && deck.status === 'published');
if (publishedDecks.length !== 7) {
  errors.push('exactly seven decks must be published');
}
if (decks.length !== allowedDeckIds.size || decks.some((deck) => !isRecord(deck) || !allowedDeckIds.has(text(deck.id)))) {
  errors.push('only the seven approved flashcard decks may exist');
}
for (const [id, nameFi] of requiredExpansionDecks) {
  const matches = publishedDecks.filter((deck) => isRecord(deck) && deck.id === id && deck.nameFi === nameFi);
  if (matches.length !== 1) errors.push(`required published deck missing or duplicated: ${id}`);
  if (!cards.some((card) => isRecord(card) && card.status === 'published' && card.deckId === id)) {
    errors.push(`required published deck is empty: ${id}`);
  }
}
for (const card of cards) {
  if (!isRecord(card) || card.status !== 'published') continue;
  const id = text(card.id);
  const sv = normalizeCanonical(text(card.sv), 'sv');
  for (const [prefix, deckId] of expansionPrefixes) {
    if (id.startsWith(prefix) && card.deckId !== deckId) errors.push(`expanded card uses wrong target deck: ${id}`);
  }
  if (excludedRoleTerms.has(sv)) errors.push(`excluded role term is published: ${id}`);
}
if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
const expectedDescriptionCounts = [8, 7, 7, 8, 6, 7, 8];
const actualDescriptionCounts = descriptionCategories
  .filter((category) => isRecord(category) && category.status === 'published')
  .map((category) => {
    const categoryId = isRecord(category) ? category.id : undefined;
    return descriptions.filter(
      (item) => isRecord(item) && item.status === 'published' && item.categoryId === categoryId,
    ).length;
  });
if (
  descriptionCategories.length !== 7 ||
  actualDescriptionCounts.length !== expectedDescriptionCounts.length ||
  actualDescriptionCounts.some((count, index) => count !== expectedDescriptionCounts[index])
) {
  console.error(`- description category counts must be ${expectedDescriptionCounts.join(', ')}`);
  process.exit(1);
}
console.log(`Content valid: ${decks.length} decks, ${cards.length} cards, ${descriptions.length} descriptions in ${descriptionCategories.length} categories.`);
