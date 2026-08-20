import { addGrade, cardSides, luckySelection, retryMissed, shuffled, summary, type Grade } from '../lib/session';
import type { Direction, Flashcard } from '../types/content';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const source = byId<HTMLScriptElement>('cards-data').textContent ?? '[]';
const allCards = JSON.parse(source) as Flashcard[];
const params = new URLSearchParams(location.search);
const direction: Direction = params.get('direction') === 'sv-fi' ? 'sv-fi' : 'fi-sv';
const lucky = params.get('lucky') === '1';
const deckId = params.get('deck');
let cards = lucky ? luckySelection(allCards) : shuffled(allCards.filter((card) => card.deckId === deckId));
let index = 0, grades: Grade[] = [], revealed = false, graded = false;

const sessionView = byId('session-view'), summaryView = byId('summary-view');
const render = () => {
  const card = cards[index];
  if (!card) { finish(); return; }
  const sides = cardSides(card, direction);
  byId('progress').textContent = `${index + 1} / ${cards.length}`;
  byId('progress-bar').style.width = `${index / cards.length * 100}%`;
  byId('side-label').textContent = direction === 'fi-sv' ? 'Suomeksi' : 'Ruotsiksi';
  byId('answer-label').textContent = direction === 'fi-sv' ? 'Ruotsiksi' : 'Suomeksi';
  byId('front-term').textContent = sides.front;
  byId('front-term').lang = sides.frontLang;
  byId('back-term').textContent = sides.back;
  byId('back-term').lang = sides.answerLang;
  byId('grammar').textContent = direction === 'fi-sv' && card.inflection ? card.inflection : '';
  byId('answer-area').hidden = !revealed;
  byId('reveal-actions').hidden = revealed;
  byId('grade-actions').hidden = !revealed || graded;
  byId('next-actions').hidden = !graded;
};
const reveal = () => { if (!revealed) { revealed = true; render(); byId<HTMLButtonElement>('correct').focus(); } };
const grade = (correct: boolean) => {
  if (!revealed || graded) return;
  const card = cards[index]; if (!card) return;
  grades = addGrade(grades, card.id, correct); graded = true; render(); byId<HTMLButtonElement>('next').focus();
};
const next = () => { if (!graded) return; index++; revealed = false; graded = false; render(); byId<HTMLButtonElement>('reveal').focus(); };
function finish() {
  sessionView.hidden = true; summaryView.hidden = false;
  const result = summary(grades);
  byId('summary-copy').textContent = `Osasit ${result.correct} / ${result.total} korttia.`;
  byId('summary-percent').textContent = `${result.percentage} %`;
  byId<HTMLButtonElement>('retry').hidden = result.missed === 0;
  byId<HTMLButtonElement>('retry').focus();
}
byId('reveal').addEventListener('click', reveal);
byId('correct').addEventListener('click', () => grade(true));
byId('missed').addEventListener('click', () => grade(false));
byId('next').addEventListener('click', next);
byId('retry').addEventListener('click', () => {
  cards = shuffled(retryMissed(cards, grades)); grades = []; index = 0; revealed = false; graded = false;
  summaryView.hidden = true; sessionView.hidden = false; render(); byId<HTMLButtonElement>('reveal').focus();
});
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.code === 'Space' && !revealed) { event.preventDefault(); reveal(); }
  else if (event.key === '1') grade(true);
  else if (event.key === '2') grade(false);
  else if (event.key === 'Enter') next();
});
render();
