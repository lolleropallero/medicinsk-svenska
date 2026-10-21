import { isReasonableSessionId } from '../lib/session';
import { formatDuration } from '../lib/time';
import {
  createExamTest, EXAM_TEST_STORAGE_KEY, gradeExamTest, isStoredExamTest,
  moveExamTest, submitExamTest, updateExamTestAnswer,
  type ExamTestSession, type ExamTestTerm,
} from '../lib/exam-test-session';

function initializeExamTest() {
  if (!document.getElementById('exam-test-app')) return;
  const node = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const terms = JSON.parse(node('exam-test-data').textContent ?? '[]') as ExamTestTerm[];
  const termById = new Map(terms.map((term) => [term.id, term]));
  const params = new URLSearchParams(location.search);
  let sessionId = params.get('session');
  if (params.has('session') && !isReasonableSessionId(sessionId)) {
    node('exam-test-question-view').hidden = true;
    node('exam-test-error').hidden = false;
    node('exam-test-error-title').focus();
    return;
  }
  const urlFor = (id: string) => `${location.pathname}?${new URLSearchParams({ session: id })}`;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    history.replaceState(null, '', urlFor(sessionId));
  }
  let stored: unknown = null;
  try { stored = JSON.parse(localStorage.getItem(EXAM_TEST_STORAGE_KEY) ?? 'null'); } catch { /* Recreate invalid optional browser state. */ }
  let session: ExamTestSession = isStoredExamTest(stored, termById, sessionId) ? stored : createExamTest(terms, sessionId);
  const input = node<HTMLInputElement>('exam-test-answer');
  const questionView = node('exam-test-question-view');
  const summaryView = node('exam-test-summary');
  const previous = node<HTMLButtonElement>('exam-test-previous');
  const next = node<HTMLButtonElement>('exam-test-next');
  const errorsOnly = node<HTMLInputElement>('exam-test-errors-only');
  const controller = new AbortController();
  const options = { signal: controller.signal };

  function persist() {
    try { localStorage.setItem(EXAM_TEST_STORAGE_KEY, JSON.stringify(session)); } catch { /* The exam remains usable without browser storage. */ }
  }
  function updateTime() {
    const duration = Math.max(0, (session.completedAt ?? Date.now()) - session.startedAt);
    const time = node<HTMLTimeElement>('exam-test-time');
    time.textContent = formatDuration(duration);
    time.dateTime = `PT${Math.floor(duration / 1000)}S`;
    time.setAttribute('aria-label', `Kulunut aika ${time.textContent}`);
    node<HTMLTimeElement>('exam-test-summary-time').textContent = time.textContent;
  }
  function renderResults() {
    const summary = gradeExamTest(session, termById);
    node('exam-test-total').textContent = `${summary.total} / 100`;
    node('exam-test-swedish').textContent = `${summary.swedish} / 50`;
    node('exam-test-finnish').textContent = `${summary.finnish} / 50`;
    node('exam-test-results').replaceChildren(...summary.results.flatMap((result, index) => {
      if (errorsOnly.checked && result.correct) return [];
      const row = document.createElement('li');
      row.value = index + 1;
      row.dataset.result = result.correct ? 'correct' : result.score.points > 0 ? 'partial' : 'incorrect';
      const heading = document.createElement('h3');
      heading.textContent = result.direction === 'fi-sv' ? result.term.fi : result.term.sv;
      heading.lang = result.direction === 'fi-sv' ? 'fi' : 'sv';
      const status = document.createElement('strong');
      status.textContent = `${result.correct ? 'Oikein' : result.score.points > 0 ? 'Osittain oikein' : 'Väärin'} · ${result.score.points} / 2 p`;
      status.className = result.correct ? 'correct-text' : 'incorrect-text';
      const answer = document.createElement('p');
      answer.append('Vastauksesi: ');
      const submitted = document.createElement('span');
      submitted.lang = result.direction === 'fi-sv' ? 'sv' : 'fi';
      submitted.textContent = result.answer || 'Ei vastausta';
      answer.append(submitted);
      const expected = document.createElement('p');
      expected.append('Hyväksytty vastaus: ');
      const model = document.createElement('strong');
      model.lang = submitted.lang;
      model.textContent = (result.direction === 'fi-sv' ? result.term.svAnswers : result.term.fiAnswers).join(' / ');
      expected.append(model);
      const points = document.createElement('p');
      points.textContent = `Termi: ${result.score.termPoints} / ${result.score.termMaximum} p${result.score.classMaximum ? ` · Taivutusluokka: ${result.score.classPoints} / 1 p` : ''}`;
      row.append(heading, status, points, answer, expected);
      return [row];
    }));
  }
  function render(focus = true) {
    updateTime();
    const completed = session.completedAt !== null;
    questionView.hidden = completed;
    summaryView.hidden = !completed;
    node('exam-test-progress').textContent = completed ? '50 / 50' : `${session.currentIndex + 1} / 50`;
    if (completed) {
      renderResults();
      if (focus) node('exam-test-summary-title').focus();
      return;
    }
    const question = session.questions[session.currentIndex]!;
    const term = termById.get(question.termId)!;
    const swedish = question.direction === 'fi-sv';
    node('exam-test-direction').textContent = `${swedish ? 'Kirjoita ruotsiksi' : 'Kirjoita suomeksi'} · ${session.currentIndex % 25 + 1} / 25`;
    node('exam-test-instructions').textContent = swedish
      ? 'Termi artikkelineen 1 p + listaan merkitty taivutusluokka 1 p. Ilman listattua luokkaa termi antaa 2 p. Esimerkki: ett barn 5. Yksi listan synonyymeistä riittää.'
      : 'Kirjoita suomenkielinen termi. Oikeasta vastauksesta saa 2 p. Yksi listan synonyymeistä riittää.';
    const prompt = node('exam-test-prompt');
    prompt.textContent = swedish ? term.fi : term.sv;
    prompt.lang = swedish ? 'fi' : 'sv';
    input.lang = swedish ? 'sv' : 'fi';
    input.value = session.answers[session.currentIndex]!;
    input.enterKeyHint = session.currentIndex === 49 ? 'done' : 'next';
    previous.hidden = session.currentIndex === 0;
    next.textContent = session.currentIndex === 49 ? 'Palauta tentti' : 'Seuraava';
    node('exam-test-progress-bar').style.width = `${session.currentIndex / 50 * 100}%`;
    if (focus) input.focus({ preventScroll: true });
  }
  input.addEventListener('input', () => {
    session = updateExamTestAnswer(session, input.value);
    persist();
  }, options);
  node<HTMLFormElement>('exam-test-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (session.completedAt !== null) return;
    session = updateExamTestAnswer(session, input.value);
    session = session.currentIndex === 49 ? submitExamTest(session) : moveExamTest(session, session.currentIndex + 1);
    persist();
    render();
    window.scrollTo({ top: 0 });
  }, options);
  previous.addEventListener('click', () => {
    session = moveExamTest(updateExamTestAnswer(session, input.value), session.currentIndex - 1);
    persist(); render();
  }, options);
  errorsOnly.addEventListener('change', renderResults, options);
  node('exam-test-new').addEventListener('click', () => {
    session = createExamTest(terms, crypto.randomUUID());
    history.replaceState(null, '', urlFor(session.sessionId));
    errorsOnly.checked = false;
    persist(); render(); window.scrollTo({ top: 0 });
  }, options);
  persist(); render();
  const timer = window.setInterval(updateTime, 1000);
  document.addEventListener('astro:before-swap', () => { window.clearInterval(timer); controller.abort(); }, { once: true });
}

document.addEventListener('astro:page-load', initializeExamTest);
