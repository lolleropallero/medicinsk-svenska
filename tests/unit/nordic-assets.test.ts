import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { flattenNordicAssetPaths, nordicAssetPaths } from '../../src/lib/nordic-asset-inventory';
import { mappedAsset, nordicAssets } from '../../src/lib/nordic-assets';

describe('Nordic Asset Pack V1', () => {
  it('maps exactly 45 SVGs with the required category counts', () => {
    expect(flattenNordicAssetPaths()).toHaveLength(45);
    expect(Object.keys(nordicAssetPaths.brand)).toHaveLength(5);
    expect(Object.keys(nordicAssetPaths.backgrounds)).toHaveLength(3);
    expect(Object.keys(nordicAssetPaths.rewardBoxes)).toHaveLength(3);
    expect(Object.keys(nordicAssetPaths.rewardPrimitives)).toHaveLength(5);
    expect(Object.keys(nordicAssetPaths.rarity)).toHaveLength(4);
    expect(Object.keys(nordicAssetPaths.achievements)).toHaveLength(12);
    expect(Object.keys(nordicAssetPaths.leagues)).toHaveLength(6);
    expect(Object.keys(nordicAssetPaths.decks)).toHaveLength(7);
    expect(flattenNordicAssetPaths().every((path) => path.endsWith('.svg'))).toBe(true);
  });

  it('resolves every mapped URL and fails an invalid fallback lookup safely', () => {
    const urls = Object.values(nordicAssets).flatMap((category) => Object.values(category));
    expect(urls).toHaveLength(45);
    expect(urls.every((url) => typeof url === 'string' && url.includes('.svg'))).toBe(true);
    expect(mappedAsset(nordicAssets.decks, 'missing')).toBeUndefined();
  });

  it('maps brand, markers, boxes, compact primitives, rarity, achievements, leagues, and decks exactly', () => {
    expect(nordicAssetPaths.brand.mark).toBe('brand/brand-mark.svg');
    expect(nordicAssetPaths.brand.languageFi).toBe('brand/language-corner-fi.svg');
    expect(nordicAssetPaths.brand.languageSv).toBe('brand/language-corner-sv.svg');
    expect(nordicAssetPaths.rewardBoxes).toEqual({ standard:'rewards/box-standard.svg',golden:'rewards/box-golden.svg',legendary:'rewards/box-legendary.svg' });
    expect(Object.values(nordicAssetPaths.rewardPrimitives)).toEqual([
      'rewards/box-cross-fi.svg','rewards/box-cross-sv.svg','rewards/box-seal-common.svg','rewards/box-seal-golden.svg','rewards/box-seal-legendary.svg',
    ]);
    expect(Object.values(nordicAssetPaths.rarity)).toEqual(['rarity/frame-common.svg','rarity/frame-rare.svg','rarity/frame-epic.svg','rarity/frame-legendary.svg']);
    expect(Object.values(nordicAssetPaths.achievements)).toEqual([
      'achievements/first-item.svg','achievements/items-10.svg','achievements/items-100.svg','achievements/items-500.svg','achievements/days-3.svg','achievements/days-10.svg','achievements/streak-3.svg','achievements/streak-7.svg','achievements/xp-100.svg','achievements/xp-1000.svg','achievements/modes-3.svg','achievements/active-60.svg',
    ]);
    expect(Object.values(nordicAssetPaths.leagues)).toEqual(['league/bronze.svg','league/silver.svg','league/gold.svg','league/platinum.svg','league/diamond.svg','league/master.svg']);
    expect(nordicAssetPaths.decks).toEqual({
      anatomi:'deck-icons/anatomy.svg',sjukdomar:'deck-icons/diseases.svg','forsta-hjalpen':'deck-icons/first-aid.svg',mediciner:'deck-icons/medicines.svg',avdelningar:'deck-icons/departments.svg','vastaanotto-anamneesi':'deck-icons/anamnesis.svg','tutkimukset-hoito':'deck-icons/examinations.svg',
    });
  });

  it('keeps supplied assets decorative while visible HTML retains status text', () => {
    const language = readFileSync(new URL('../../src/components/LanguageRibbon.astro', import.meta.url), 'utf8');
    const achievement = readFileSync(new URL('../../src/scripts/progress-ui.ts', import.meta.url), 'utf8');
    expect(language).toContain('alt=""');
    expect(language).toContain('aria-hidden="true"');
    expect(achievement).toMatch(/unlocked\s*\?\s*["']Upplåst["']\s*:\s*["']Låst["']/);
  });

  it('assigns study, light, and dark backgrounds by route intensity', () => {
    const backdrop = readFileSync(new URL('../../src/components/NordicBackdrop.astro', import.meta.url), 'utf8');
    const layout = readFileSync(new URL('../../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
    expect(backdrop).toContain('intensity === 1 ? nordicAssets.backgrounds.study');
    expect(backdrop).toContain('intensity === 3 ? nordicAssets.backgrounds.dark : nordicAssets.backgrounds.light');
    expect(layout).toContain("const intensity=exerciseRoute?1:path.startsWith('/palkinnot')||path.startsWith('/kausi')?3:2");
  });
});
