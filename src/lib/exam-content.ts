import topicsData from '../../content/exam-vocabulary.json';
import type { DeckClient, Flashcard, FlashcardClient } from '../types/content';

export const examTopics = topicsData;
export const examDeckPayload: DeckClient[] = examTopics.map(({ id, nameFi }) => ({ id, nameFi }));

// Keep removed source positions reserved so saved progress stays with the same words.
// Positions must stay in ascending order when more cards are removed.
const retiredSourcePositions: Record<string, readonly number[]> = {
  anatomi: [132],
  'tentti-sydansairaudet': [4, 44],
  'tentti-tutkiminen': [11],
};

function sourcePosition(topicId: string, index: number): number {
  return (retiredSourcePositions[topicId] ?? []).reduce(
    (position, retired) => position >= retired ? position + 1 : position,
    index + 1,
  );
}

// Preserve the remaining source wording and grammar notation on both sides.
export const examCards: Flashcard[] = examTopics.flatMap((topic) => topic.entries.map((entry, index) => ({
  id: `tenttisanasto-${topic.id}-${String(sourcePosition(topic.id, index)).padStart(3, '0')}`,
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
