import type { Direction, FlashcardClient } from '../types/content';
import { cardSides, seededRandom, shuffled } from './session';

export interface ChoiceOption {
  id: string;
  label: string;
  correct: boolean;
}

export function vocabularyPromptText(card: FlashcardClient, direction: Direction): string {
  return cardSides(card, direction).front;
}

export function vocabularyAnswerText(card: FlashcardClient, direction: Direction): string {
  return cardSides(card, direction).back;
}

export function normalizeWrittenAnswer(value: string): string {
  return value
    .normalize('NFC')
    .trim()
    .toLocaleLowerCase('sv')
    .replace(/[’‘]/gu, "'")
    .replace(/\s*\/\s*/gu, ' / ')
    .replace(/\s+/gu, ' ')
    .replace(/[.!?]+$/u, '')
    .trim();
}

export function isWrittenAnswerCorrect(
  card: FlashcardClient,
  direction: Direction,
  answer: string,
): boolean {
  return normalizeWrittenAnswer(answer) === normalizeWrittenAnswer(vocabularyAnswerText(card, direction));
}

export function stableChoiceRandom(sessionId: string, cardId: string, attemptCount: number): () => number {
  let seed = 2166136261;
  const source = `${sessionId}:${cardId}:${attemptCount}`;
  for (let index = 0; index < source.length; index += 1) {
    seed ^= source.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return seededRandom(seed >>> 0);
}

export function createMultipleChoiceOptions(
  current: FlashcardClient,
  cards: readonly FlashcardClient[],
  direction: Direction,
  random: () => number = Math.random,
): ChoiceOption[] {
  const correctLabel = vocabularyAnswerText(current, direction);
  const used = new Set([normalizeWrittenAnswer(correctLabel)]);
  const distractors = shuffled(cards, random).flatMap((card) => {
    if (card.id === current.id) return [];
    const label = vocabularyAnswerText(card, direction);
    const normalized = normalizeWrittenAnswer(label);
    if (!normalized || used.has(normalized)) return [];
    used.add(normalized);
    return [{ id: card.id, label, correct: false }];
  }).slice(0, 3);

  if (distractors.length < 3) return [];
  return shuffled([{ id: current.id, label: correctLabel, correct: true }, ...distractors], random);
}
