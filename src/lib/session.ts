import type { Direction, Flashcard } from '../types/content';

export type RandomSource = () => number;
export interface Grade { cardId: string; correct: boolean }

export function shuffled<T>(items: readonly T[], random: RandomSource = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function luckySelection(cards: readonly Flashcard[], limit = 50, random: RandomSource = Math.random): Flashcard[] {
  const unique = [...new Map(cards.filter((card) => card.status === 'published').map((card) => [card.id, card])).values()];
  return shuffled(unique, random).slice(0, Math.min(limit, unique.length));
}

export function cardSides(card: Flashcard, direction: Direction) {
  const swedish = `${card.article ? `${card.article} ` : ''}${card.sv}`;
  return direction === 'fi-sv'
    ? { front: card.fi, back: swedish, frontLang: 'fi', answerLang: 'sv' }
    : { front: swedish, back: card.fi, frontLang: 'sv', answerLang: 'fi' };
}

export function revealState(revealed: boolean) { return { revealed: true, canGrade: !revealed }; }
export function addGrade(grades: readonly Grade[], cardId: string, correct: boolean): Grade[] {
  return [...grades.filter((grade) => grade.cardId !== cardId), { cardId, correct }];
}
export function summary(grades: readonly Grade[]) {
  const correct = grades.filter((grade) => grade.correct).length;
  return { total: grades.length, correct, missed: grades.length - correct, percentage: grades.length ? Math.round(correct / grades.length * 100) : 0 };
}
export function retryMissed(cards: readonly Flashcard[], grades: readonly Grade[]) {
  const missed = new Set(grades.filter((grade) => !grade.correct).map((grade) => grade.cardId));
  return cards.filter((card) => missed.has(card.id));
}
export function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}
