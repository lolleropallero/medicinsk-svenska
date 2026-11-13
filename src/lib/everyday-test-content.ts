import { everydayCardPayload } from './everyday-content';
import { cardSides } from './session';
import type { ExamTestTerm } from './exam-test-session';

export const everydayTestTerms: ExamTestTerm[] = everydayCardPayload.map(card => ({
  id: card.id, topicIds: [card.deckId], fi: card.fi,
  sv: cardSides(card, 'fi-sv').back,
  // Parenthetical sense hints help recall; they are not required in a Finnish answer.
  fiAnswers: [...new Set([card.fi, card.fi.replace(/\s*\([^)]*\)/gu, '').trim()])],
  svAnswers: [cardSides(card, 'fi-sv').back],
}));
