import decksData from '../../content/decks.json';
import cardsData from '../../content/flashcards.json';
import descriptionsData from '../../content/descriptions.json';
import descriptionCategoriesData from '../../content/description-categories.json';
import phraseCategoriesData from '../../content/phrase-categories.json';
import phrasesData from '../../content/phrases.json';
import type {
  Deck,
  DeckClient,
  DescriptionExercise,
  DescriptionExerciseClient,
  DescriptionCategory,
  DescriptionCategoryClient,
  Flashcard,
  FlashcardClient,
  PhraseCategory,
  PhraseCategoryClient,
  ClinicalPhrase,
  ClinicalPhraseClient,
} from '../types/content';

export const decks = decksData as Deck[];
export const cards = cardsData as Flashcard[];
export const descriptions = descriptionsData as DescriptionExercise[];
export const descriptionCategories = descriptionCategoriesData as DescriptionCategory[];
export const phraseCategories = phraseCategoriesData as PhraseCategory[];
export const phrases = phrasesData as ClinicalPhrase[];
export const publishedDecks = decks.filter((deck) => deck.status === 'published');
export const publishedCards = cards.filter((card) => card.status === 'published');
export const publishedDescriptions = descriptions.filter((item) => item.status === 'published');
export const publishedDescriptionCategories = descriptionCategories.filter((item) => item.status === 'published');
export const publishedPhraseCategories = phraseCategories.filter((item) => item.status === 'published');
export const publishedPhrases = phrases.filter((item) => item.status === 'published');

export const phraseCategoryPayload: PhraseCategoryClient[] = publishedPhraseCategories.map((item) => ({
  id: item.id,
  nameFi: item.nameFi,
}));

export const phrasePayload: ClinicalPhraseClient[] = publishedPhrases.map((item) => ({
  id: item.id,
  categoryId: item.categoryId,
  fi: item.fi,
  sv: item.sv,
}));

export const descriptionCategoryPayload: DescriptionCategoryClient[] = publishedDescriptionCategories.map((item) => ({
  id: item.id,
  nameFi: item.nameFi,
}));

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
  categoryId: item.categoryId,
  descriptionSv: item.descriptionSv,
  answerSv: item.answerSv,
  ...(item.acceptedInflections ? { acceptedInflections: item.acceptedInflections } : {}),
  ...(item.article ? { article: item.article } : {}),
  ...(item.inflection ? { inflection: item.inflection } : {}),
}));
