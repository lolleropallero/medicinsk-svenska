import { isAcceptedAnswer } from '../lib/descriptions';
import { shuffled } from '../lib/session';
import type { DescriptionExerciseClient } from '../types/content';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const all = JSON.parse(byId<HTMLScriptElement>('descriptions-data').textContent ?? '[]') as DescriptionExerciseClient[];
let items = shuffled(all), missed: DescriptionExerciseClient[] = [], correct = 0, index = 0, resolved = false;
const session = byId('description-session'), summaryView = byId('description-summary');

const render = () => {
  const item = items[index]; if (!item) { finish(); return; }
  byId('description-progress').textContent = `${index + 1} / ${items.length}`;
  byId('description-progress-bar').style.width = `${index / items.length * 100}%`;
  byId('description-text').textContent = item.descriptionSv;
  byId<HTMLInputElement>('answer').value = '';
  byId('description-feedback').hidden = true; byId('answer-form').hidden = false; resolved = false;
  byId<HTMLInputElement>('answer').focus();
};
const resolve = (didMatch: boolean, revealed: boolean) => {
  if (resolved) return; resolved = true;
  const item = items[index]; if (!item) return;
  if (didMatch) correct++; else missed.push(item);
  byId('result-label').textContent = didMatch ? 'Oikein' : revealed ? 'Vastaus näytetty' : 'Ei aivan';
  byId('result-label').className = didMatch ? 'correct-text' : 'incorrect-text';
  byId('canonical-answer').textContent = `${item.article ? `${item.article} ` : ''}${item.answerSv}`;
  byId('answer-form').hidden = true; byId('description-feedback').hidden = false; byId<HTMLButtonElement>('description-next').focus();
};
byId<HTMLFormElement>('answer-form').addEventListener('submit', (event) => {
  event.preventDefault(); const item = items[index]; if (item) resolve(isAcceptedAnswer(item, byId<HTMLInputElement>('answer').value), false);
});
byId('show-answer').addEventListener('click', () => resolve(false, true));
byId('description-next').addEventListener('click', () => { index++; render(); });
function finish() {
  session.hidden = true; summaryView.hidden = false;
  byId('description-summary-copy').textContent = `${correct} / ${items.length} oikein`;
  byId<HTMLButtonElement>('description-retry').hidden = missed.length === 0;
}
byId('description-retry').addEventListener('click', () => {
  items = shuffled(missed); missed = []; correct = 0; index = 0; summaryView.hidden = true; session.hidden = false; render();
});
render();
