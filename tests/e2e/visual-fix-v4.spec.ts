import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PROGRESS = 'medicinsk-svenska.progress.v1';
const backgroundImage = (page: Page) => page.locator('.nordic-backdrop').evaluate((node) => getComputedStyle(node).backgroundImage);

test('HUD is a separated 2x2 mobile grid and a four-column desktop grid', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key) !== null, PROGRESS)).toBe(true);
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.lifetime.xp = 1280;
    state.streak.current = 42;
    state.inventory.credits = 123456;
    state.inventory.capsules.push({ id: 'hud-box-1', kind: 'standard', earnedAt: Date.now() }, { id: 'hud-box-2', kind: 'golden', earnedAt: Date.now() + 1 });
    localStorage.setItem(key, JSON.stringify(state));
  }, PROGRESS);

  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.reload();
    const cards = page.locator('.hud-stat');
    await expect(cards).toHaveCount(4);
    await expect(page.locator('.hud-stat__label')).toHaveText(['Nivå', 'Svit', 'Krediter', 'Belöningar']);
    await expect(page.locator('.hud-stat__value')).toHaveText([/\d+/, '42', '123456', '2']);
    await expect(page.locator('.hud-boxes img')).toHaveAttribute('src', /reward-hud/);
    await expect(page.locator('[class*="box-seal"],[class*="box-cross"],.compact-box-surface')).toHaveCount(0);
    const geometry = await cards.evaluateAll((nodes) => nodes.map((node) => {
      const card = node.getBoundingClientRect();
      const icon = node.querySelector('.hud-stat__icon')!.getBoundingClientRect();
      const label = node.querySelector('.hud-stat__label')!.getBoundingClientRect();
      const value = node.querySelector('.hud-stat__value')!.getBoundingClientRect();
      return { card: card.toJSON(), icon: icon.toJSON(), label: label.toJSON(), value: value.toJSON() };
    }));
    expect(new Set(geometry.map(({ card }) => Math.round(card.top))).size).toBe(2);
    expect(new Set(geometry.map(({ card }) => Math.round(card.left))).size).toBe(2);
    for (const { card, icon, label, value } of geometry) {
      expect(value.top - label.bottom).toBeGreaterThanOrEqual(4);
      expect(icon.right <= label.left || icon.left >= label.right || icon.bottom <= label.top || icon.top >= label.bottom).toBe(true);
      expect(label.left).toBeGreaterThanOrEqual(card.left);
      expect(label.right).toBeLessThanOrEqual(card.right);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  const desktopCards = await page.locator('.hud-stat').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
  expect(new Set(desktopCards.map((rect) => Math.round(rect.top))).size).toBe(1);
  expect(new Set(desktopCards.map((rect) => Math.round(rect.left))).size).toBe(4);
});

test('all seven description rows use the exact direct V4 category assets', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/kuvailu/');
  const expected = ['cells', 'skeleton', 'neuro', 'cardio', 'blood', 'digestion', 'hormones'];
  const images = page.locator('.category-row > .description-category-icon');
  await expect(images).toHaveCount(7);
  for (let index = 0; index < expected.length; index += 1) {
    await expect(images.nth(index)).toHaveAttribute('src', new RegExp(`${expected[index]}\\.`));
    await expect(images.nth(index)).toHaveAttribute('alt', '');
    await expect(images.nth(index)).toHaveAttribute('aria-hidden', 'true');
  }
  expect(new Set(await images.evaluateAll((nodes: HTMLImageElement[]) => nodes.map((node) => node.src))).size).toBe(7);
  await expect(page.locator('.category-row .row-icon')).toHaveCount(0);
  const styles = await images.evaluateAll((nodes) => nodes.map((node) => ({ background: getComputedStyle(node).backgroundImage, border: getComputedStyle(node).borderStyle, width: node.getBoundingClientRect().width })));
  expect(styles.every(({ background, border, width }) => background === 'none' && border === 'none' && width >= 44 && width <= 56)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('reward cards and reveal use Kruunu & Kilpi shields without any overlay seal', async ({ page }) => {
  await page.goto('/palkinnot/');
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key) !== null, PROGRESS)).toBe(true);
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.inventory.capsules.push(
      { id: 'v4-standard', kind: 'standard', earnedAt: Date.now() },
      { id: 'v4-golden', kind: 'golden', earnedAt: Date.now() + 1 },
      { id: 'v4-legendary', kind: 'legendary', earnedAt: Date.now() + 2 },
    );
    localStorage.setItem(key, JSON.stringify(state));
  }, PROGRESS);
  await page.reload();
  for (const kind of ['standard', 'golden', 'legendary']) {
    const image = page.locator(`.capsule.box-${kind} .reward-box-visual > img`);
    await expect(image).toHaveAttribute('src', new RegExp(`reward-${kind}\\.`));
    const box = await image.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(108);
    expect(box!.height).toBeGreaterThanOrEqual(90);
  }
  await expect(page.locator('[class*="box-seal"],[class*="box-cross"],.compact-box-surface')).toHaveCount(0);
  await page.locator('.capsule.box-golden').click();
  await expect(page.locator('.capsule-dialog .reward-box-visual > img')).toHaveAttribute('src', /reward-golden/);
  const reveal = await page.locator('.capsule-dialog .reward-box-visual > img').boundingBox();
  expect(reveal!.width).toBeGreaterThanOrEqual(180);
  await expect(page.locator('.capsule-dialog [class*="box-seal"],.capsule-dialog [class*="box-cross"]')).toHaveCount(0);
});

test('all four route backgrounds load visibly as same-origin WebPs with correct MIME', async ({ page }) => {
  const failed: string[] = [];
  const external: string[] = [];
  const mime = new Map<string, string>();
  page.on('request', (request) => {
    if (request.resourceType() === 'image' || request.resourceType() === 'font') {
      if (new URL(request.url()).origin !== new URL(page.url()).origin) external.push(request.url());
    }
  });
  page.on('response', (response) => {
    if (/\.(?:svg|webp)(?:$|\?)/i.test(response.url())) {
      if (response.status() >= 400) failed.push(response.url());
      const contentType = response.headers()['content-type'];
      if (contentType) mime.set(response.url(), contentType);
    }
  });
  const routes = [
    ['/', 'home-dark'],
    ['/palkinnot/', 'rewards-dark'],
    ['/kausi/', 'rewards-dark'],
    ['/kortit/', 'shell-light'],
    ['/fraasit/', 'shell-light'],
    ['/kuvailu/', 'shell-light'],
    ['/tilanteet/', 'shell-light'],
    ['/edistyminen/', 'shell-light'],
    ['/kortit/harjoitus?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=v4-bg-card', 'study-light'],
    ['/fraasit/harjoitus?mode=all&amount=10&session=v4-bg-phrase', 'study-light'],
    ['/kuvailu/harjoitus?mode=all&amount=10&session=v4-bg-description', 'study-light'],
    ['/tilanteet/harjoitus?case=rintakipu&session=v4-bg-clinical', 'study-light'],
  ] as const;
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    for (const [route, asset] of routes) {
      await page.goto(route);
      expect(await backgroundImage(page)).toContain(asset);
      const backdrop = await page.locator('.nordic-backdrop').evaluate((node) => {
        const style = getComputedStyle(node);
        const last = (value: string) => value.split(',').at(-1)?.trim();
        return { size: last(style.backgroundSize), repeat: last(style.backgroundRepeat), opacity: style.opacity, attachment: last(style.backgroundAttachment) };
      });
      expect(backdrop).toEqual({ size: 'cover', repeat: 'no-repeat', opacity: '1', attachment: 'scroll' });
    }
  }
  expect(failed).toEqual([]);
  expect(external).toEqual([]);
  for (const [url, contentType] of mime) {
    if (url.includes('.webp')) expect(contentType).toContain('image/webp');
    if (url.includes('.svg')) expect(contentType).toContain('image/svg+xml');
  }
});
