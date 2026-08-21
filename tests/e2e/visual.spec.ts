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

test('capture required visual QA views', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.screenshot({ path: 'tmp/visual/landing-desktop.png', fullPage: true });
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

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.screenshot({ path: 'tmp/visual/landing-mobile.png', fullPage: true });
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

  await page.setViewportSize({ width: 844, height: 390 });
  await seedSingleDescription(page, 'visual-description-landscape');
  await page.screenshot({ path: 'tmp/visual/description-landscape.png', fullPage: true });
});
