import { test } from '@playwright/test';
import { openSpecificCard } from './helpers';

async function seedSingleDescription(page: import('@playwright/test').Page, sessionId: string) {
  await page.goto(`/kuvailu/harjoitus?mode=all&amount=10&session=${sessionId}`);
  await page.evaluate(({ id }) => localStorage.setItem('medicinsk-svenska.description-session.v1', JSON.stringify({
    schemaVersion: 1, sessionId: id, sourceMode: 'all', requestedAmount: 10, roundType: 'initial',
    selectedExerciseIds: ['beskrivning-023'], currentIndex: 0, currentResolvedResult: null,
    currentDraftAnswer: '', resultsByExercise: {}, startedAt: Date.now(),
  })), { id: sessionId });
  await page.reload();
}

async function seedPhraseView(
  page: import('@playwright/test').Page,
  sessionId: string,
  state: 'unrevealed' | 'revealed' | 'waiting' | 'complete',
) {
  const phraseId = 'fraasi-oireet-vointi-gora-ont';
  await page.goto(`/fraasit/harjoitus?mode=category&category=oireet-vointi&amount=10&session=${sessionId}`);
  await page.evaluate(({ id, phraseId, state }) => localStorage.setItem('medicinsk-svenska.phrase-session.v1', JSON.stringify({
    schemaVersion: 1, sessionId: id, mode: 'category', sourceCategoryId: 'oireet-vointi', requestedAmount: 10,
    selectedPhraseIds: [phraseId], unseenPhraseQueue: [],
    currentPhraseId: state === 'unrevealed' || state === 'revealed' ? phraseId : null,
    revealed: state === 'revealed', masteredPhraseIds: state === 'complete' ? [phraseId] : [],
    pendingRetries: state === 'waiting' ? [{ phraseId, dueAt: Date.now() + 300_000 }] : [],
    attemptCountByPhrase: state === 'waiting' || state === 'complete' ? { [phraseId]: 1 } : {},
    firstAttemptCorrectByPhrase: state === 'waiting' ? { [phraseId]: false } : state === 'complete' ? { [phraseId]: true } : {},
    totalMissedCount: state === 'waiting' ? 1 : 0, startedAt: Date.now() - 65_000,
  })), { id: sessionId, phraseId, state });
  await page.reload();
}

test('capture required visual QA views', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.screenshot({ path: 'tmp/visual/landing-desktop.png', fullPage: true });
  await page.goto('/edistyminen/');
  await page.screenshot({ path: 'tmp/visual/progress-desktop.png', fullPage: true });
  await page.goto('/palkinnot/');
  await page.locator('.inventory-head').waitFor();
  await page.evaluate(() => {
    const key='medicinsk-svenska.progress.v1',state=JSON.parse(localStorage.getItem(key)!);
    state.inventory.credits=420;state.inventory.capsules.push({id:'visual-capsule',kind:'golden',earnedAt:Date.now()});
    localStorage.setItem(key,JSON.stringify(state));
  });
  await page.reload();
  await page.screenshot({ path: 'tmp/visual/rewards-collection-shop-desktop.png', fullPage: true });
  await page.getByRole('button',{name:/Kultainen palkintokapseli Avaa/}).click();
  await page.screenshot({ path: 'tmp/visual/capsule-revealed-desktop.png', fullPage: true });
  await page.getByRole('button',{name:'Sulje'}).click();
  await page.goto('/kausi/');
  await page.screenshot({ path: 'tmp/visual/season-league-desktop.png', fullPage: true });
  await page.goto('/edistyminen/');
  await page.locator('#calm-mode').check();
  await page.screenshot({ path: 'tmp/visual/calm-mode-desktop.png', fullPage: true });
  await page.goto('/kortit');
  await page.screenshot({ path: 'tmp/visual/decks-desktop.png', fullPage: true });
  await openSpecificCard(page, { id: 'anatomi-024', deckId: 'anatomi' }, 'fi-sv');
  await page.getByRole('button', { name: /Näytä vastaus/ }).click();
  await page.screenshot({ path: 'tmp/visual/noun-irregular-desktop.png', fullPage: true });
  await openSpecificCard(page, { id: 'anatomi-004', deckId: 'anatomi' }, 'sv-fi');
  await page.getByRole('button', { name: /Näytä vastaus/ }).click();
  await page.screenshot({ path: 'tmp/visual/swedish-finnish-desktop.png', fullPage: true });
  await openSpecificCard(page, { id: 'mediciner-096', deckId: 'mediciner' }, 'fi-sv');
  await page.getByRole('button', { name: /Näytä vastaus/ }).click();
  await page.screenshot({ path: 'tmp/visual/verb-forms-desktop.png', fullPage: true });
  await page.goto('/kuvailu');
  await page.screenshot({ path: 'tmp/visual/description-desktop.png', fullPage: true });
  await page.goto('/kuvailu/harjoitus?mode=all&amount=10&session=visual-description');
  await page.screenshot({ path: 'tmp/visual/description-question-desktop.png', fullPage: true });
  await page.getByLabel('Vastauksesi').fill('keskeneräinen');
  await page.reload();
  await page.screenshot({ path: 'tmp/visual/description-restored-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.screenshot({ path: 'tmp/visual/description-revealed-desktop.png', fullPage: true });
  await seedSingleDescription(page, 'visual-description-incorrect');
  await page.getByLabel('Vastauksesi').fill('fel');
  await page.getByRole('button', { name: 'Tarkista' }).click();
  await page.screenshot({ path: 'tmp/visual/description-incorrect-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Seuraava' }).click();
  await page.screenshot({ path: 'tmp/visual/description-missed-summary-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Harjoittele virheet uudelleen' }).click();
  await page.screenshot({ path: 'tmp/visual/description-retry-desktop.png', fullPage: true });
  await seedSingleDescription(page, 'visual-description-correct');
  await page.getByLabel('Vastauksesi').fill('hjärta');
  await page.getByRole('button', { name: 'Tarkista' }).click();
  await page.screenshot({ path: 'tmp/visual/description-correct-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Seuraava' }).click();
  await page.screenshot({ path: 'tmp/visual/description-summary-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Uusi kierros' }).click();
  await page.screenshot({ path: 'tmp/visual/description-new-round-desktop.png', fullPage: true });
  await page.goto('/kuvailu/harjoitus?mode=category&category=missing&amount=10&session=visual-description-invalid');
  await page.screenshot({ path: 'tmp/visual/description-invalid-desktop.png', fullPage: true });
  await page.goto('/fraasit');
  await page.screenshot({ path: 'tmp/visual/phrases-setup-desktop.png', fullPage: true });
  await seedPhraseView(page, 'visual-phrase-question', 'unrevealed');
  await page.screenshot({ path: 'tmp/visual/phrase-question-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.screenshot({ path: 'tmp/visual/phrase-revealed-desktop.png', fullPage: true });
  await seedPhraseView(page, 'visual-phrase-summary', 'complete');
  await page.screenshot({ path: 'tmp/visual/phrase-summary-desktop.png', fullPage: true });
  await page.goto('/fraasit/harjoitus?mode=category&category=missing&amount=10&session=visual-phrase-invalid');
  await page.screenshot({ path: 'tmp/visual/phrase-invalid-desktop.png', fullPage: true });
  await page.goto('/kortit/harjoitus?mode=deck&deck=avdelningar&direction=fi-sv&amount=10&session=visual-summary');
  for (let index = 0; index < 10; index += 1) {
    await page.getByRole('button', { name: 'Näytä vastaus' }).click();
    await page.getByRole('button', { name: 'Osasin' }).click();
  }
  await page.screenshot({ path: 'tmp/visual/summary-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Uusi kierros' }).click();
  await page.screenshot({ path: 'tmp/visual/new-round-desktop.png', fullPage: true });
  await page.goto('/kortit/harjoitus?mode=deck&deck=missing&direction=fi-sv&amount=10&session=visual-invalid');
  await page.screenshot({ path: 'tmp/visual/invalid-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await openSpecificCard(page, { id: 'mediciner-095', deckId: 'mediciner' }, 'fi-sv');
  await page.getByRole('button', { name: /Näytä vastaus/ }).click();
  await page.screenshot({ path: 'tmp/visual/adjective-mobile.png', fullPage: true });
  await seedSingleDescription(page, 'visual-description-mobile-question');
  await page.screenshot({ path: 'tmp/visual/description-question-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.screenshot({ path: 'tmp/visual/description-feedback-mobile.png', fullPage: true });
  await page.goto('/kortit/harjoitus?mode=deck&deck=missing&direction=fi-sv&amount=10&session=visual-invalid-mobile');
  await page.screenshot({ path: 'tmp/visual/invalid-mobile.png', fullPage: true });
  await seedPhraseView(page, 'visual-phrase-waiting', 'waiting');
  await page.screenshot({ path: 'tmp/visual/phrase-waiting-mobile.png', fullPage: true });

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.screenshot({ path: 'tmp/visual/landing-mobile.png', fullPage: true });
  await page.goto('/edistyminen/');
  await page.screenshot({ path: 'tmp/visual/progress-mobile-320.png', fullPage: true });
  await page.goto('/kausi/');
  await page.screenshot({ path: 'tmp/visual/season-mobile-320.png', fullPage: true });
  await page.goto('/kortit');
  await page.screenshot({ path: 'tmp/visual/decks-mobile.png', fullPage: true });
  await openSpecificCard(page, { id: 'sjukdomar-091', deckId: 'sjukdomar' }, 'sv-fi');
  await page.screenshot({ path: 'tmp/visual/long-compound-mobile.png', fullPage: true });
  await page.goto('/kortit/harjoitus?mode=deck&deck=avdelningar&direction=fi-sv&amount=10&session=visual-waiting');
  for (let index = 0; index < 10; index += 1) {
    await page.getByRole('button', { name: 'Näytä vastaus' }).click();
    await page.getByRole('button', { name: index < 3 ? 'En osannut' : 'Osasin' }).click();
  }
  await page.screenshot({ path: 'tmp/visual/waiting-mobile.png', fullPage: true });
  await page.goto('/kuvailu');
  await page.screenshot({ path: 'tmp/visual/description-mobile.png', fullPage: true });
  await page.goto('/fraasit');
  await page.screenshot({ path: 'tmp/visual/phrases-setup-mobile.png', fullPage: true });

  await page.setViewportSize({ width: 844, height: 390 });
  await seedSingleDescription(page, 'visual-description-landscape');
  await page.screenshot({ path: 'tmp/visual/description-landscape.png', fullPage: true });
  await seedPhraseView(page, 'visual-phrase-landscape', 'revealed');
  await page.screenshot({ path: 'tmp/visual/phrase-landscape.png', fullPage: true });
});
