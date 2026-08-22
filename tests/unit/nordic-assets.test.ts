import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { flattenNordicAssetPaths, nordicAssetPaths } from '../../src/lib/nordic-asset-inventory';
import { mappedAsset, nordicAssets } from '../../src/lib/nordic-assets';
import { flattenVisualFixAssetPaths, visualFixAssetPaths } from '../../src/lib/visual-fix-asset-inventory';
import { visualFixAssets } from '../../src/lib/visual-fix-assets';

describe('Nordic Asset Pack V1', () => {
  it('retains exactly 34 non-superseded Nordic SVGs with the required category counts', () => {
    expect(flattenNordicAssetPaths()).toHaveLength(34);
    expect(Object.keys(nordicAssetPaths.brand)).toHaveLength(5);
    expect(Object.keys(nordicAssetPaths.rarity)).toHaveLength(4);
    expect(Object.keys(nordicAssetPaths.achievements)).toHaveLength(12);
    expect(Object.keys(nordicAssetPaths.leagues)).toHaveLength(6);
    expect(Object.keys(nordicAssetPaths.decks)).toHaveLength(7);
    expect(flattenNordicAssetPaths().every((path) => path.endsWith('.svg'))).toBe(true);
  });

  it('resolves every mapped URL and fails an invalid fallback lookup safely', () => {
    const urls = Object.values(nordicAssets).flatMap((category) => Object.values(category));
    expect(urls).toHaveLength(34);
    expect(urls.every((url) => typeof url === 'string' && url.includes('.svg'))).toBe(true);
    expect(mappedAsset(nordicAssets.decks, 'missing')).toBeUndefined();
  });

  it('maps retained brand, rarity, achievements, leagues, and decks exactly', () => {
    expect(nordicAssetPaths.brand.mark).toBe('brand/brand-mark.svg');
    expect(nordicAssetPaths.brand.languageFi).toBe('brand/language-corner-fi.svg');
    expect(nordicAssetPaths.brand.languageSv).toBe('brand/language-corner-sv.svg');
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

  it('maps exactly 15 V4 assets with exact 4 / 7 / 4 category counts', () => {
    expect(flattenVisualFixAssetPaths()).toHaveLength(15);
    expect(Object.keys(visualFixAssetPaths.rewards)).toHaveLength(4);
    expect(Object.keys(visualFixAssetPaths.descriptionCategories)).toHaveLength(7);
    expect(Object.keys(visualFixAssetPaths.backgrounds)).toHaveLength(4);
    expect(Object.values(visualFixAssets).flatMap((category) => Object.values(category))).toHaveLength(15);
  });

  it('maps all reward boxes, description categories, and backgrounds exactly', () => {
    expect(visualFixAssetPaths.rewards).toEqual({
      hud: 'rewards/box-hud.svg', standard: 'rewards/box-standard.svg', golden: 'rewards/box-golden.svg', legendary: 'rewards/box-legendary.svg',
    });
    expect(visualFixAssetPaths.descriptionCategories).toEqual({
      'solut-kudokset-iho': 'category-icons/cells.svg',
      'luusto-nivelet-lihakset': 'category-icons/skeleton.svg',
      'hermosto-aistit': 'category-icons/neuro.svg',
      'verenkierto-hengitys': 'category-icons/cardio.svg',
      'veri-imunestejarjestelma': 'category-icons/blood.svg',
      'ruoansulatus-virtsatiet': 'category-icons/digestion.svg',
      'lisaantyminen-hormonit': 'category-icons/hormones.svg',
    });
    expect(visualFixAssetPaths.backgrounds).toEqual({
      homeDark: 'backgrounds/home-dark.webp', rewardsDark: 'backgrounds/rewards-dark.webp', shellLight: 'backgrounds/shell-light.webp', studyLight: 'backgrounds/study-light.webp',
    });
    expect(new Set(Object.values(visualFixAssets.descriptionCategories)).size).toBe(7);
  });

  it('assigns home, reward, shell, and study backgrounds by route', () => {
    const backdrop = readFileSync(new URL('../../src/components/NordicBackdrop.astro', import.meta.url), 'utf8');
    const layout = readFileSync(new URL('../../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
    expect(backdrop).toContain('visualFixAssets.backgrounds[kind]');
    expect(layout).toContain("exerciseRoute?'studyLight':rewardRoute?'rewardsDark':path==='/'?'homeDark':'shellLight'");
  });

  it('keeps HUD label/value nodes separate and removes the seal-based reward construction', () => {
    const shell = readFileSync(new URL('../../src/scripts/progress-shell.ts', import.meta.url), 'utf8');
    const rewardUi = readFileSync(new URL('../../src/scripts/progress-ui.ts', import.meta.url), 'utf8');
    const compact = readFileSync(new URL('../../src/components/CompactRewardBox.astro', import.meta.url), 'utf8');
    expect(shell).toContain('hud-stat__label');
    expect(shell).toContain('hud-stat__value');
    expect(shell).toContain('>Lådor</span>');
    expect(`${shell}${rewardUi}${compact}`).not.toMatch(/box-seal|box-cross|compact-box-surface/);
    expect(compact).toContain('visualFixAssets.rewards.hud');
  });
});
