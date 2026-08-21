import type { DescriptionExerciseClient } from '../types/content';

export function normalizeAnswer(value: string): string {
  return value.trim().toLocaleLowerCase('sv').normalize('NFC').replace(/\p{P}+/gu, '').replace(/\s+/g, ' ');
}
export function isAcceptedAnswer(item: DescriptionExerciseClient, answer: string): boolean {
  const accepted = [item.answerSv, ...(item.acceptedInflections ?? [])].map(normalizeAnswer);
  const normalized = normalizeAnswer(answer);
  if (accepted.includes(normalized)) return true;
  return Boolean(item.article) && normalized === `${item.article} ${normalizeAnswer(item.answerSv)}`;
}
