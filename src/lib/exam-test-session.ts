import type { Direction } from '../types/content';
import { isReasonableSessionId, shuffled } from './session';
import { normalizeExamAnswer } from './exam-test-answers';

export const EXAM_TEST_STORAGE_KEY = 'medicinsk-svenska.exam-test.v1';
export interface ExamTestTerm {
  id: string; topicIds: string[]; fi: string; sv: string; fiAnswers: string[]; svAnswers: string[];
}
export interface ExamTestQuestion { termId: string; direction: Direction }
export interface ExamTestSession {
  schemaVersion: 1; sessionId: string; questions: ExamTestQuestion[]; answers: string[];
  currentIndex: number; startedAt: number; completedAt: number | null;
}

export function createExamTest(terms: readonly ExamTestTerm[], sessionId: string, now = Date.now(), random = Math.random): ExamTestSession {
  if (!isReasonableSessionId(sessionId)) throw new Error('Invalid exam session ID');
  const topicIds = [...new Set(terms.flatMap((term) => term.topicIds))];
  let remaining = shuffled([...new Map(terms.map((term) => [term.id, term])).values()], random);
  const questions: ExamTestQuestion[] = [];
  for (const direction of ['fi-sv', 'sv-fi'] as const) {
    const selected: ExamTestTerm[] = [];
    for (const topicId of shuffled(topicIds, random)) {
      const index = remaining.findIndex((term) => term.topicIds.includes(topicId));
      if (index < 0) throw new Error('Not enough unique terms in every exam topic');
      selected.push(...remaining.splice(index, 1));
    }
    selected.push(...remaining.splice(0, 25 - selected.length));
    if (selected.length !== 25) throw new Error('Exam needs fifty unique terms');
    questions.push(...shuffled(selected, random).map((term) => ({ termId: term.id, direction })));
  }
  return { schemaVersion: 1, sessionId, questions, answers: Array<string>(50).fill(''), currentIndex: 0, startedAt: now, completedAt: null };
}

export function updateExamTestAnswer(session: ExamTestSession, answer: string): ExamTestSession {
  if (session.completedAt !== null) return session;
  const answers = [...session.answers];
  answers[session.currentIndex] = answer.slice(0, 500);
  return { ...session, answers };
}

export function moveExamTest(session: ExamTestSession, index: number): ExamTestSession {
  return session.completedAt !== null || !Number.isInteger(index) || index < 0 || index >= 50 ? session : { ...session, currentIndex: index };
}

export function submitExamTest(session: ExamTestSession, now = Date.now()): ExamTestSession {
  return session.completedAt !== null ? session : { ...session, completedAt: Math.max(now, session.startedAt) };
}

export interface ExamTestAnswerScore {
  points: number; termPoints: number; termMaximum: 1 | 2; classPoints: number; classMaximum: 0 | 1;
}

function scoreSwedishVariant(expected: string, submitted: string): ExamTestAnswerScore {
  const marker = expected.match(/\b(?:[1-5]|I{1,3}|IV)\b/u);
  const answer = normalizeExamAnswer(submitted);
  if (!marker) {
    const points = normalizeExamAnswer(expected) === answer ? 2 : 0;
    return { points, termPoints: points, termMaximum: 2, classPoints: 0, classMaximum: 0 };
  }
  const expectedTerm = normalizeExamAnswer(expected.replace(marker[0], ''));
  const expectedClass = marker[0].toLowerCase();
  const tokens = answer.split(' ');
  const candidates = tokens.flatMap((token, index) => index > 0 && /^(?:\d+|[ivx]+)$/u.test(token) ? [{ token, index }] : []);
  // Match the term independently of a supplied class, including an incorrect class.
  const matchingTerm = candidates.find(({ index }) => tokens.filter((_, position) => position !== index).join(' ') === expectedTerm);
  const termPoints = answer === expectedTerm || matchingTerm ? 1 : 0;
  let classPoints = 0;
  if (matchingTerm) classPoints = matchingTerm.token === expectedClass ? 1 : 0;
  else if (answer !== expectedTerm) {
    // Preposition i and placeholder X can be lexical tokens rather than extra class guesses.
    const lexicalMarkers = new Map<string, number>();
    expectedTerm.split(' ').forEach((token) => {
      if (/^[ivx]+$/u.test(token)) lexicalMarkers.set(token, (lexicalMarkers.get(token) ?? 0) + 1);
    });
    const markers = [...candidates];
    for (let index = markers.length - 1; index >= 0 && markers.length > 1; index--) {
      const token = markers[index]!.token, count = lexicalMarkers.get(token) ?? 0;
      if (count > 0) { markers.splice(index, 1); lexicalMarkers.set(token, count - 1); }
    }
    if (markers.length === 1 && markers[0]!.token === expectedClass) classPoints = 1;
  }
  return { points: termPoints + classPoints, termPoints, termMaximum: 1, classPoints, classMaximum: 1 };
}

export function scoreExamTestAnswer(term: ExamTestTerm, direction: Direction, answer: string): ExamTestAnswerScore {
  const accepted = direction === 'fi-sv' ? term.svAnswers : term.fiAnswers;
  // One listed synonym is enough. If multiple alternatives are supplied, use the weakest answer.
  const alternatives = answer.split(/\s*[/;,]\s*/u).map((part) => {
    if (direction === 'sv-fi') {
      const points = accepted.some((candidate) => normalizeExamAnswer(candidate) === normalizeExamAnswer(part)) ? 2 : 0;
      return { points, termPoints: points, termMaximum: 2 as const, classPoints: 0, classMaximum: 0 as const };
    }
    return accepted.map((candidate) => scoreSwedishVariant(candidate, part))
      .sort((a, b) => b.points - a.points || b.termPoints - a.termPoints)[0]!;
  });
  return alternatives.sort((a, b) => a.points - b.points)[0]!;
}

export function isExamTestAnswerCorrect(term: ExamTestTerm, direction: Direction, answer: string): boolean {
  return scoreExamTestAnswer(term, direction, answer).points === 2;
}

export function gradeExamTest(session: ExamTestSession, terms: ReadonlyMap<string, ExamTestTerm>) {
  const results = session.questions.map((question, index) => {
    const term = terms.get(question.termId)!;
    const score = scoreExamTestAnswer(term, question.direction, session.answers[index]!);
    return { ...question, term, answer: session.answers[index]!, score, correct: score.points === 2 };
  });
  return {
    results, total: results.reduce((sum, result) => sum + result.score.points, 0),
    swedish: results.filter((result) => result.direction === 'fi-sv').reduce((sum, result) => sum + result.score.points, 0),
    finnish: results.filter((result) => result.direction === 'sv-fi').reduce((sum, result) => sum + result.score.points, 0),
  };
}

export function isStoredExamTest(value: unknown, terms: ReadonlyMap<string, ExamTestTerm>, sessionId: string): value is ExamTestSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const session = value as ExamTestSession;
  if (session.schemaVersion !== 1 || !isReasonableSessionId(session.sessionId) || session.sessionId !== sessionId ||
      !Number.isInteger(session.currentIndex) || session.currentIndex < 0 || session.currentIndex >= 50 ||
      !Number.isFinite(session.startedAt) || session.startedAt < 0 ||
      !(session.completedAt === null || (Number.isFinite(session.completedAt) && session.completedAt >= session.startedAt)) ||
      !Array.isArray(session.questions) || session.questions.length !== 50 ||
      !Array.isArray(session.answers) || session.answers.length !== 50 ||
      !session.answers.every((answer) => typeof answer === 'string' && answer.length <= 500)) return false;
  if (!session.questions.every((question, index) => question && typeof question === 'object' &&
      terms.has(question.termId) && question.direction === (index < 25 ? 'fi-sv' : 'sv-fi')) ||
      new Set(session.questions.map((question) => question.termId)).size !== 50) return false;
  const topics = new Set([...terms.values()].flatMap((term) => term.topicIds));
  return [session.questions.slice(0, 25), session.questions.slice(25)].every((half) =>
    [...topics].every((topic) => half.some((question) => terms.get(question.termId)!.topicIds.includes(topic))),
  );
}
