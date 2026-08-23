import { expect, test } from '@playwright/test';

const origin = 'https://medicinsksvenska.fi';

for (const [label, route, canonicalPath] of [
  ['home', '/', '/'],
  ['exercise', '/kortit/harjoitus/?mode=lucky&utm_source=test', '/kortit/harjoitus/'],
  ['metagame', '/edistyminen/?utm_campaign=test', '/edistyminen/'],
] as const) {
  test(`${label} exposes one query-free canonical and Open Graph URL`, async ({ page }) => {
    await page.goto(route);
    const canonical = page.locator('link[rel="canonical"]');
    const openGraphUrl = page.locator('meta[property="og:url"]');
    await expect(canonical).toHaveCount(1);
    await expect(openGraphUrl).toHaveCount(1);
    await expect(canonical).toHaveAttribute('href', `${origin}${canonicalPath}`);
    await expect(openGraphUrl).toHaveAttribute('content', `${origin}${canonicalPath}`);
  });
}

test('robots and generated sitemap expose only the canonical production origin', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain(`Sitemap: ${origin}/sitemap-index.xml`);
  expect(robots).not.toContain('workers.dev');
  const index = await (await request.get('/sitemap-index.xml')).text();
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(index).toContain(`${origin}/sitemap-0.xml`);
  expect(sitemap).toContain(`${origin}/`);
  expect(sitemap).toContain(`${origin}/kortit/harjoitus/`);
  expect(sitemap).toContain(`${origin}/edistyminen/`);
  expect(`${index}${sitemap}`).not.toContain('workers.dev');
});
