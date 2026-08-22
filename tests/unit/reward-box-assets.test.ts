import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  rewardBoxAsset,
  rewardBoxAssets,
  rewardBoxImage,
  standardBoxV5Assets,
  type RewardBoxKind,
  type RewardBoxSize,
} from '../../src/lib/reward-box-assets';
import { flattenStandardBoxV5AssetPaths, standardBoxV5AssetPaths } from '../../src/lib/standard-box-v5-asset-inventory';

describe('Standard Reward Box V5', () => {
  it('maps the three standard sizes to their dedicated V5 files', () => {
    expect(rewardBoxAsset('standard', 'small')).toContain('box-standard-hud.png');
    expect(rewardBoxAsset('standard', 'normal')).toContain('box-standard-card.png');
    expect(rewardBoxAsset('standard', 'large')).toContain('box-standard-hero.png');
    expect(standardBoxV5Assets).toEqual({
      hud: rewardBoxAssets.standard.small,
      card: rewardBoxAssets.standard.normal,
      hero: rewardBoxAssets.standard.large,
    });
  });

  it.each([
    ['golden', 'small'], ['golden', 'normal'], ['golden', 'large'],
    ['legendary', 'small'], ['legendary', 'normal'], ['legendary', 'large'],
  ] as [RewardBoxKind, RewardBoxSize][])('%s + %s uses its genuine kind asset', (kind, size) => {
    expect(rewardBoxAsset(kind, size)).toContain(`box-${kind}.svg`);
    expect(rewardBoxAsset(kind, size)).not.toMatch(/box-standard-(?:hud|card|hero)\.png/);
  });

  it('exposes exact intrinsic dimensions for every standard variant', () => {
    expect(rewardBoxImage('standard', 'small')).toMatchObject({ width: 258, height: 227 });
    expect(rewardBoxImage('standard', 'normal')).toMatchObject({ width: 453, height: 403 });
    expect(rewardBoxImage('standard', 'large')).toMatchObject({ width: 707, height: 609 });
  });

  it('inventories exactly the three production PNGs and no reference sheet', () => {
    expect(flattenStandardBoxV5AssetPaths()).toEqual([
      'box-standard-hud.png', 'box-standard-card.png', 'box-standard-hero.png',
    ]);
    expect(Object.values(standardBoxV5AssetPaths).join('\n')).not.toContain('reference-sheet');
  });

  it('keeps old V4 standard assets inactive and compact rendering kind-aware', () => {
    const sources = [
      '../../src/lib/reward-box-assets.ts',
      '../../src/components/CompactRewardBox.astro',
      '../../src/components/RewardBoxVisual.astro',
      '../../src/scripts/progress-shell.ts',
      '../../src/scripts/progress-ui.ts',
    ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
    expect(sources).not.toMatch(/box-(?:hud|standard)\.svg|reference-sheet\.png/);
    expect(sources).toContain('rewardBoxImage(kind, "small")');
    expect(sources).toContain('rewardBoxImage(normalizeRewardBoxKind(kind), "small")');
  });
});
