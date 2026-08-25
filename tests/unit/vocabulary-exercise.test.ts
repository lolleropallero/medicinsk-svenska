import { describe, expect, it } from 'vitest';
import {
  createMultipleChoiceOptions,
  isWrittenAnswerCorrect,
  normalizeWrittenAnswer,
  vocabularyAnswerText,
  vocabularyPromptText,
} from '../../src/lib/vocabulary-exercise';
import { seededRandom } from '../../src/lib/session';
import type { FlashcardClient } from '../../src/types/content';

const card = (id: string, fi: string, sv: string, article?: 'en' | 'ett'): FlashcardClient => ({
  id,
  deckId: 'd',
  fi,
  sv,
  ...(article ? { article } : {}),
  partOfSpeech: 'noun',
});

const pool = [
  card('a', 'verikoe', 'blodprov', 'ett'),
  card('b', 'virtsakoe', 'urinprov', 'ett'),
  card('c', 'ulostenäyte', 'avföringsprov', 'ett'),
  card('d', 'viitearvo', 'referensvärde', 'ett'),
  card('e', 'tulehdus', 'inflammation', 'en'),
];

describe('vocabulary exercise helpers', () => {
  it('uses existing canonical sides in both language directions', () => {
    expect(vocabularyPromptText(pool[0]!, 'fi-sv')).toBe('verikoe');
    expect(vocabularyAnswerText(pool[0]!, 'fi-sv')).toBe('ett blodprov');
    expect(vocabularyPromptText(pool[0]!, 'sv-fi')).toBe('ett blodprov');
    expect(vocabularyAnswerText(pool[0]!, 'sv-fi')).toBe('verikoe');
  });

  it('creates four multiple-choice options with exactly one correct answer', () => {
    const options = createMultipleChoiceOptions(pool[0]!, pool, 'fi-sv', seededRandom(1));
    expect(options).toHaveLength(4);
    expect(options.filter((option) => option.correct)).toEqual([{ id: 'a', label: 'ett blodprov', correct: true }]);
    expect(new Set(options.map((option) => normalizeWrittenAnswer(option.label))).size).toBe(4);
  });

  it('deduplicates invalid distractors before choosing alternatives', () => {
    const duplicate = card('duplicate', 'toinen verikoe', 'blodprov', 'ett');
    const options = createMultipleChoiceOptions(pool[0]!, [pool[0]!, duplicate, ...pool.slice(1)], 'fi-sv', seededRandom(2));
    expect(options).toHaveLength(4);
    expect(options.map((option) => option.id)).not.toContain('duplicate');
  });

  it('returns no multiple-choice set when four unique alternatives are impossible', () => {
    expect(createMultipleChoiceOptions(pool[0]!, [pool[0]!, pool[1]!, pool[2]!], 'fi-sv', seededRandom(3))).toEqual([]);
  });

  it('normalizes written answers without fuzzy guessing', () => {
    expect(isWrittenAnswerCorrect(pool[0]!, 'fi-sv', '  ETT   blodprov. ')).toBe(true);
    expect(isWrittenAnswerCorrect(pool[0]!, 'fi-sv', 'blodprov')).toBe(false);
    expect(isWrittenAnswerCorrect(card('x', 'röda/vita verisolut', 'röda / vita blodkroppar'), 'sv-fi', 'röda / vita verisolut')).toBe(true);
    expect(isWrittenAnswerCorrect(pool[4]!, 'fi-sv', 'en inflamation')).toBe(false);
  });
});
