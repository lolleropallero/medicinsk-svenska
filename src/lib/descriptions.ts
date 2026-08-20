import type { DescriptionExercise } from '../types/content';

export function normalizeAnswer(value: string): string {
  return value.trim().toLocaleLowerCase('sv').normalize('NFC').replace(/[.,!?;:'"()\-]/g, '').replace(/\s+/g, ' ');
}
export function isAcceptedAnswer(item: DescriptionExercise, answer: string): boolean {
  const accepted = [item.answerSv, ...(item.acceptedInflections ?? [])].map(normalizeAnswer);
  return accepted.includes(normalizeAnswer(answer));
}
