export type PublicationStatus = 'published' | 'review' | 'skipped';
export type Direction = 'fi-sv' | 'sv-fi';
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'other';

export interface Deck { id: string; nameFi: string; status: PublicationStatus }
export interface Flashcard {
  id: string; deckId: string; fi: string; sv: string; article?: 'en' | 'ett';
  partOfSpeech: PartOfSpeech; inflection?: string; status: PublicationStatus;
}
export interface DescriptionExercise {
  id: string; descriptionSv: string; answerSv: string; acceptedInflections?: string[];
  article?: 'en' | 'ett'; inflection?: string; status: PublicationStatus;
}

export type FlashcardClient = Omit<Flashcard, 'status'>;
export type DescriptionExerciseClient = Omit<DescriptionExercise, 'status'>;
export type DeckClient = Omit<Deck, 'status'>;
