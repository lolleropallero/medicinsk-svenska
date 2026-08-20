import decksData from '../../content/decks.json';
import cardsData from '../../content/flashcards.json';
import descriptionsData from '../../content/descriptions.json';
import type { Deck, DescriptionExercise, Flashcard } from '../types/content';

export const decks = decksData as Deck[];
export const cards = cardsData as Flashcard[];
export const descriptions = descriptionsData as DescriptionExercise[];
export const publishedDecks = decks.filter((deck) => deck.status === 'published');
export const publishedCards = cards.filter((card) => card.status === 'published');
export const publishedDescriptions = descriptions.filter((item) => item.status === 'published');
