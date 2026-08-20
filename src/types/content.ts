export type PublicationStatus = 'published' | 'review' | 'skipped';
export type Direction = 'fi-sv' | 'sv-fi';

export interface SourceRef { document: string; page: number; item?: string; section?: string }
export interface Deck { id: string; nameFi: string; descriptionFi: string; sourceDocument: string; status: PublicationStatus }
export interface Flashcard {
  id: string; deckId: string; fi: string; sv: string; article?: 'en' | 'ett';
  partOfSpeech?: string; inflection?: string; status: PublicationStatus; source: SourceRef;
}
export interface DescriptionExercise {
  id: string; descriptionSv: string; answerSv: string; acceptedInflections?: string[];
  article?: 'en' | 'ett'; inflection?: string; status: PublicationStatus; source: SourceRef;
}
