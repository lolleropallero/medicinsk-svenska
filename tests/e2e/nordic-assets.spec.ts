import { expect, test, type Locator } from '@playwright/test';
import { openSpecificCard } from './helpers';

const PROGRESS = 'medicinsk-svenska.progress.v1';
const loaded = async (image: Locator) => {
  await expect(image).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0), { timeout: 10_000 }).toBe(true);
};
const filename = async (image: Locator) => image.getAttribute('src');

test('brand, backgrounds, language corners, and all deck icons use supplied SVG assets', async ({ page }) => {
  await page.goto('/');
  const brand = page.locator('header .brand-mark');
  await loaded(brand);
  expect(await filename(brand)).toContain('brand-mark');
  await expect(page.locator('svg.brand-mark,.brand-mark svg')).toHaveCount(0);
  expect(await page.locator('.nordic-backdrop').evaluate((node) => getComputedStyle(node).backgroundImage)).toContain('home-dark');

  await page.goto('/kortit/');
  const deckImages = page.locator('.deck-row .deck-icon img');
  await expect(deckImages).toHaveCount(7);
  const expectedDecks = ['anatomy','diseases','first-aid','medicines','departments','anamnesis','examinations'];
  for (let index = 0; index < expectedDecks.length; index += 1) {
    await loaded(deckImages.nth(index));
    expect(await filename(deckImages.nth(index))).toContain(expectedDecks[index]);
  }
  expect(new Set(await deckImages.evaluateAll((images: HTMLImageElement[]) => images.map((image) => image.src))).size).toBe(7);

  for (const direction of ['fi-sv','sv-fi'] as const) {
    await openSpecificCard(page, { id:'anatomi-004', deckId:'anatomi' }, direction);
    expect(await page.locator('.nordic-backdrop').evaluate((node) => getComputedStyle(node).backgroundImage)).toContain('study-light');
    await expect(page.locator('#flashcard .language-ribbon, #flashcard img')).toHaveCount(0);
    await expect(page.locator('#front-term')).toHaveAttribute('lang', direction === 'fi-sv' ? 'fi' : 'sv');
    await expect(page.locator('#back-term')).toHaveAttribute('lang', direction === 'fi-sv' ? 'sv' : 'fi');
    await page.getByRole('button', { name:'Näytä vastaus' }).click();
    await expect(page.locator('#back-term')).toBeVisible();
  }

  await page.goto('/fraasit/harjoitus?mode=all&amount=10&session=nordic-assets-phrase');
  await expect(page.locator('.phrase-card .language-ribbon, .phrase-card img')).toHaveCount(0);
  await page.getByRole('button', { name:'Näytä vastaus' }).click();
  await expect(page.locator('.phrase-card .language-ribbon, .phrase-card img')).toHaveCount(0);

  await page.goto('/kuvailu/harjoitus?mode=all&amount=10&session=nordic-assets-description');
  await expect(page.locator('.description-card .language-ribbon, .description-card img')).toHaveCount(0);
});

test('Kruunu & Kilpi rewards, rarity frames, achievements, and league shields are loaded', async ({ page }) => {
  await page.goto('/palkinnot/');
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key) !== null, PROGRESS)).toBe(true);
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.inventory.credits = 1000;
    state.inventory.capsules.push(
      { id:'asset-standard', kind:'standard', earnedAt:Date.now() },
      { id:'asset-golden', kind:'golden', earnedAt:Date.now() + 1 },
      { id:'asset-legendary', kind:'legendary', earnedAt:Date.now() + 2 },
    );
    localStorage.setItem(key, JSON.stringify(state));
  }, PROGRESS);
  await page.reload();
  for (const kind of ['standard','golden','legendary']) {
    const box = page.locator(`.capsule.box-${kind} .reward-box-visual > img`);
    await loaded(box);
    expect(await filename(box)).toContain(`reward-${kind}`);
  }
  await expect(page.locator('#daily-shop .offer[data-offer-type="cosmetic"] .cosmetic-preview')).toHaveCount(2);
  await expect(page.locator('#daily-shop .rarity-frame')).toHaveCount(0);
  await expect(page.locator('#daily-shop .reward-offer-media .rarity-frame')).toHaveCount(0);
  await expect(page.locator('#daily-shop .reward-offer-media .reward-box-visual > img')).toHaveAttribute('src', /reward-(?:standard|golden|legendary)/);

  await page.locator('.capsule.box-legendary').click();
  const dialogBox = page.locator('.capsule-dialog .reward-box-visual > img');
  await loaded(dialogBox);
  expect(await filename(dialogBox)).toContain('reward-legendary');
  await expect(page.locator('.capsule-dialog .cosmetic-preview,.capsule-dialog .rarity-frame')).toHaveCount(1);
  await page.getByRole('button', { name:'Stäng' }).click();

  await page.goto('/');
  await expect(page.locator('.overlay-goal')).toBeVisible();
  expect(await filename(page.locator('.overlay-goal .reward-box-visual > img'))).toContain('reward-standard');
  expect(await filename(page.locator('.daily-all-bonus .reward-box-visual > img'))).toContain('reward-golden');
  await expect(page.locator('[class*="box-seal"],[class*="box-cross"]')).toHaveCount(0);

  await page.goto('/edistyminen/');
  const achievements = page.locator('.achievement-grid .achievement-badge img');
  await expect(achievements).toHaveCount(12);
  const achievementSources = await achievements.evaluateAll((images: HTMLImageElement[]) => images.map((image) => image.src));
  for (const id of ['first-item','items-10','items-100','items-500','days-3','days-10','streak-3','streak-7','xp-100','xp-1000','modes-3','active-60']) expect(achievementSources.some((source) => source.includes(id))).toBe(true);
  await expect(page.locator('.achievement-grid')).toContainText('Låst');

  await page.goto('/kausi/');
  await page.getByRole('button', { name:'Visa alla 30 steg' }).click();
  const goldenCompact = page.locator('[data-tier="20"] .compact-reward-box');
  await expect(goldenCompact.locator('img[src*="reward-golden"]')).toHaveCount(1);
  await expect(goldenCompact.locator('img[src*="reward-standard"]')).toHaveCount(0);
  const legendaryCompact = page.locator('[data-tier="30"] .compact-reward-box');
  await expect(legendaryCompact.locator('img[src*="reward-legendary"]')).toHaveCount(1);
  await expect(legendaryCompact.locator('img[src*="reward-standard"]')).toHaveCount(0);
  await expect(legendaryCompact.locator('img')).toHaveCount(1);

  const tiers = [
    ['Pronssi','bronze'],['Hopea','silver'],['Kulta','gold'],['Platina','platinum'],['Timantti','diamond'],['Konsultti','master'],
  ] as const;
  for (const [tier, asset] of tiers) {
    await page.evaluate(({ key, tier }) => { const state=JSON.parse(localStorage.getItem(key)!);state.league.tier=tier;localStorage.setItem(key,JSON.stringify(state)); }, { key:PROGRESS, tier });
    await page.reload();
    const shield = page.locator('.league-summary .league-shield');
    await loaded(shield);
    expect(await filename(shield)).toContain(asset);
  }
  expect(await page.locator('.nordic-backdrop').evaluate((node) => getComputedStyle(node).backgroundImage)).toContain('rewards-dark');
});

test('asset requests are local SVGs, motion preferences preserve imagery, and portrait widths do not overflow', async ({ page }) => {
  const failed: string[] = [];
  const externalAssets: string[] = [];
  const webp: string[] = [];
  page.on('response', (response) => { if (/\.(?:svg|webp)(?:$|\?)/i.test(response.url()) && response.status() >= 400) failed.push(response.url()); });
  page.on('request', (request) => {
    if (request.resourceType() === 'image' || request.resourceType() === 'font') {
      const url = new URL(request.url());
      if (url.origin !== new URL(page.url()).origin) externalAssets.push(request.url());
      if (/\.webp(?:$|\?)/i.test(url.pathname)) webp.push(request.url());
    }
  });
  for (const viewport of [{width:320,height:568},{width:390,height:844},{width:768,height:1024},{width:1440,height:900}]) {
    await page.setViewportSize(viewport);
    for (const route of ['/','/kortit/','/kortit/harjoitus?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=asset-audit','/edistyminen/','/palkinnot/','/kausi/']) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${route} at ${viewport.width}`).toBe(true);
    }
  }
  await page.goto('/');
  await page.evaluate((key) => { const state=JSON.parse(localStorage.getItem(key)!);state.settings.calmMode=true;localStorage.setItem(key,JSON.stringify(state)); }, PROGRESS);
  await page.reload();
  await page.getByRole('button', { name:/Dagens uppdrag/ }).click();
  const calmAsset = page.locator('.overlay-goal .reward-box-visual');
  await expect(calmAsset).toBeVisible();
  expect(await calmAsset.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.reload();
  await page.getByRole('button', { name:/Dagens uppdrag/ }).click();
  const reducedAsset = page.locator('.overlay-goal .reward-box-visual');
  await expect(reducedAsset).toBeVisible();
  expect(await reducedAsset.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  expect(failed).toEqual([]);
  expect(externalAssets).toEqual([]);
  expect(new Set(webp.map((url) => url.match(/(home-dark|rewards-dark|shell-light|study-light)/)?.[1]))).toEqual(new Set(['home-dark','rewards-dark','shell-light','study-light']));
});
