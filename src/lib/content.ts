import decksData from '../../content/decks.json';
import cardsData from '../../content/flashcards.json';
import descriptionsData from '../../content/descriptions.json';
import type {
  Deck,
  DeckClient,
  DescriptionExercise,
  DescriptionExerciseClient,
  Flashcard,
  FlashcardClient,
} from '../types/content';

export const decks = decksData as Deck[];
export const cards = cardsData as Flashcard[];
export const descriptions = descriptionsData as DescriptionExercise[];
export const publishedDecks = decks.filter((deck) => deck.status === 'published');
export const publishedCards = cards.filter((card) => card.status === 'published');
export const publishedDescriptions = descriptions.filter((item) => item.status === 'published');

export const deckPayload: DeckClient[] = publishedDecks.map((deck) => ({
  id: deck.id,
  nameFi: deck.nameFi,
}));

export const flashcardPayload: FlashcardClient[] = publishedCards.map((card) => ({
  id: card.id,
  deckId: card.deckId,
  fi: card.fi,
  sv: card.sv,
  ...(card.article ? { article: card.article } : {}),
  partOfSpeech: card.partOfSpeech,
  ...(card.inflection ? { inflection: card.inflection } : {}),
}));

export const descriptionPayload: DescriptionExerciseClient[] = publishedDescriptions.map((item) => ({
  id: item.id,
  descriptionSv: item.descriptionSv,
  answerSv: item.answerSv,
  ...(item.acceptedInflections ? { acceptedInflections: item.acceptedInflections } : {}),
  ...(item.article ? { article: item.article } : {}),
  ...(item.inflection ? { inflection: item.inflection } : {}),
}));
