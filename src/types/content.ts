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

export interface ClinicalScenarioCategory { id: string; nameFi: string; status: PublicationStatus }
export interface ClinicalScenarioOption { id: string; sv: string; correct: boolean }
export interface ClinicalScenarioStep {
  id: string; patientSv: string; promptFi: string; options: ClinicalScenarioOption[]; explanationFi?: string;
}
export interface ClinicalScenario {
  id: string; categoryId: string; titleFi: string; contextFi: string; steps: ClinicalScenarioStep[];
  resolutionSv: string; resolutionFi: string; status: PublicationStatus;
}

export type FlashcardClient = Omit<Flashcard, 'status'>;
export type DescriptionCategoryClient = Omit<DescriptionCategory, 'status'>;
export type DescriptionExerciseClient = Omit<DescriptionExercise, 'status'>;
export type DeckClient = Omit<Deck, 'status'>;
export type PhraseCategoryClient = Omit<PhraseCategory, 'status'>;
export type ClinicalPhraseClient = Omit<ClinicalPhrase, 'status'>;
export type ClinicalScenarioCategoryClient = Omit<ClinicalScenarioCategory, 'status'>;
export type ClinicalScenarioClient = Omit<ClinicalScenario, 'status'>;
