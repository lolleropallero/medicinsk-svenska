import vocabulary from '../../content/everyday-vocabulary.json';
import type { DeckClient, FlashcardClient } from '../types/content';

export interface EverydayTopic {
  id: string;
  nameFi: string;
  entries: Omit<FlashcardClient, 'deckId'>[];
}

export const everydayTopics = vocabulary as EverydayTopic[];
export const everydayDeckPayload: DeckClient[] = everydayTopics.map(({ id, nameFi }) => ({ id, nameFi }));
// Keep this collection separate from the medical and exam pools, including review membership.
export const everydayCardPayload: FlashcardClient[] = everydayTopics.flatMap(topic => topic.entries.map(
  ({ id, fi, sv, partOfSpeech, article, inflectionClass, inflection }) => ({
    id, deckId: topic.id, fi, sv, partOfSpeech,
    ...(article ? { article } : {}),
    ...(inflectionClass ? { inflectionClass } : {}),
    ...(inflection ? { inflection } : {}),
  }),
));
