import topicsData from '../../content/exam-vocabulary.json';
import type { DeckClient, Flashcard, FlashcardClient } from '../types/content';

export const examTopics = topicsData;
export const examDeckPayload: DeckClient[] = examTopics.map(({ id, nameFi }) => ({ id, nameFi }));

// Preserve the teacher's wording, synonyms and grammar notation on both sides.
// New IDs prevent progress from the retired anatomy list attaching to different words.
export const examCards: Flashcard[] = examTopics.flatMap((topic) => topic.entries.map((entry, index) => ({
  id: `tenttisanasto-${topic.id}-${String(index + 1).padStart(3, '0')}`,
  deckId: topic.id,
  fi: topic.swedishField === 'term' ? entry.definition : entry.term,
  sv: topic.swedishField === 'term' ? entry.term : entry.definition,
  partOfSpeech: 'other',
  status: 'published',
  selfAssessmentOnly: true,
})));

export const examCardPayload: FlashcardClient[] = examCards.map(({ id, deckId, fi, sv, partOfSpeech, selfAssessmentOnly }) => ({
  id, deckId, fi, sv, partOfSpeech, ...(selfAssessmentOnly ? { selfAssessmentOnly } : {}),
}));
