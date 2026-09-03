export type PublicationStatus = 'published' | 'review' | 'skipped';
export type Direction = 'fi-sv' | 'sv-fi';
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'other';

export interface Deck { id: string; nameFi: string; status: PublicationStatus }
export interface DescriptionCategory { id: string; nameFi: string; status: PublicationStatus }
export interface PhraseCategory { id: string; nameFi: string; status: PublicationStatus }
export interface Flashcard {
  id: string; deckId: string; fi: string; sv: string; article?: 'en' | 'ett';
  partOfSpeech: PartOfSpeech; inflection?: string; status: PublicationStatus;
}
export interface DescriptionExercise {
  id: string; categoryId: string; descriptionSv: string; answerSv: string; acceptedInflections?: string[];
  article?: 'en' | 'ett'; inflection?: string; status: PublicationStatus;
}
export interface ClinicalPhrase {
  id: string; categoryId: string; fi: string; sv: string; status: PublicationStatus;
}

export interface AnamnesisItem { id: string; patientSv: string; modelQuestionsSv: string[] }
export interface AnamnesisSection { id: string; nameFi: string; items: AnamnesisItem[] }
export interface AnamnesisCase { id: string; nameFi: string; status: PublicationStatus; sections: AnamnesisSection[] }

export type FlashcardClient = Omit<Flashcard, 'status'>;
export type DescriptionCategoryClient = Omit<DescriptionCategory, 'status'>;
export type DescriptionExerciseClient = Omit<DescriptionExercise, 'status'>;
export type DeckClient = Omit<Deck, 'status'>;
export type PhraseCategoryClient = Omit<PhraseCategory, 'status'>;
export type ClinicalPhraseClient = Omit<ClinicalPhrase, 'status'>;
export type AnamnesisCaseClient = Omit<AnamnesisCase, 'status'>;
