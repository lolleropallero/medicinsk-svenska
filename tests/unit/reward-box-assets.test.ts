import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  rewardBoxAsset,
  rewardBoxAssets,
  rewardBoxImage,
  type RewardBoxKind,
  type RewardBoxSize,
} from '../../src/lib/reward-box-assets';
import { flattenRewardVisualAssetPaths, rewardVisualAssetPaths } from '../../src/lib/reward-visual-asset-inventory';

describe('Kruunu & Kilpi reward visuals', () => {
  it('maps standard sizes to the compact HUD and full standard shields', () => {
    expect(rewardBoxAsset('standard', 'small')).toContain('reward-hud.svg');
    expect(rewardBoxAsset('standard', 'normal')).toContain('reward-standard.svg');
    expect(rewardBoxAsset('standard', 'large')).toContain('reward-standard.svg');
    expect(rewardBoxAssets.standard.normal).toBe(rewardBoxAssets.standard.large);
  });

  it.each([
    ['golden', 'small'], ['golden', 'normal'], ['golden', 'large'],
    ['legendary', 'small'], ['legendary', 'normal'], ['legendary', 'large'],
  ] as [RewardBoxKind, RewardBoxSize][])('%s + %s uses its genuine kind asset', (kind, size) => {
    expect(rewardBoxAsset(kind, size)).toContain(`reward-${kind}.svg`);
    expect(rewardBoxAsset(kind, size)).not.toMatch(/box-|standard-box-v5/);
  });

  it('exposes exact intrinsic dimensions for every standard variant', () => {
    expect(rewardBoxImage('standard', 'small')).toMatchObject({ width: 120, height: 132 });
    expect(rewardBoxImage('standard', 'normal')).toMatchObject({ width: 320, height: 360 });
    expect(rewardBoxImage('standard', 'large')).toMatchObject({ width: 320, height: 360 });
  });

  it('inventories exactly the four production SVGs', () => {
    expect(flattenRewardVisualAssetPaths()).toEqual([
      'reward-hud.svg', 'reward-standard.svg', 'reward-golden.svg', 'reward-legendary.svg',
    ]);
    expect(Object.values(rewardVisualAssetPaths).every((path) => path.endsWith('.svg'))).toBe(true);
  });

  it('keeps rejected box art inactive and compact rendering kind-aware', () => {
    const sources = [
      '../../src/lib/reward-box-assets.ts',
      '../../src/components/CompactRewardBox.astro',
      '../../src/components/RewardBoxVisual.astro',
      '../../src/scripts/progress-shell.ts',
      '../../src/scripts/progress-ui.ts',
    ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
    expect(sources).not.toMatch(/standard-box-v5|visual-fix-v4\/rewards|\.png\?url/);
    expect(sources).toContain('rewardBoxImage(kind, "small")');
    expect(sources).toContain('rewardBoxImage(normalizeRewardBoxKind(kind), "small")');
  });
});
