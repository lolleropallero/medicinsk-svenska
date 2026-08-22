import boxStandardHudUrl from '../assets/standard-box-v5/box-standard-hud.png?url';
import boxStandardCardUrl from '../assets/standard-box-v5/box-standard-card.png?url';
import boxStandardHeroUrl from '../assets/standard-box-v5/box-standard-hero.png?url';
import boxGoldenUrl from '../assets/visual-fix-v4/rewards/box-golden.svg?url';
import boxLegendaryUrl from '../assets/visual-fix-v4/rewards/box-legendary.svg?url';

export type RewardBoxKind = 'standard' | 'golden' | 'legendary';
export type RewardBoxSize = 'small' | 'normal' | 'large';

export const standardBoxV5Assets = {
  hud: boxStandardHudUrl,
  card: boxStandardCardUrl,
  hero: boxStandardHeroUrl,
} as const;

export const rewardBoxAssets = {
  standard: {
    small: standardBoxV5Assets.hud,
    normal: standardBoxV5Assets.card,
    large: standardBoxV5Assets.hero,
  },
  golden: { small: boxGoldenUrl, normal: boxGoldenUrl, large: boxGoldenUrl },
  legendary: { small: boxLegendaryUrl, normal: boxLegendaryUrl, large: boxLegendaryUrl },
} as const satisfies Record<RewardBoxKind, Record<RewardBoxSize, string>>;

const rewardBoxDimensions = {
  standard: {
    small: { width: 258, height: 227 },
    normal: { width: 453, height: 403 },
    large: { width: 707, height: 609 },
  },
  golden: {
    small: { width: 360, height: 300 },
    normal: { width: 360, height: 300 },
    large: { width: 360, height: 300 },
  },
  legendary: {
    small: { width: 360, height: 300 },
    normal: { width: 360, height: 300 },
    large: { width: 360, height: 300 },
  },
} as const satisfies Record<RewardBoxKind, Record<RewardBoxSize, { width: number; height: number }>>;

export function rewardBoxAsset(kind: RewardBoxKind, size: RewardBoxSize): string {
  return rewardBoxAssets[kind][size];
}

export function rewardBoxImage(kind: RewardBoxKind, size: RewardBoxSize) {
  return { src: rewardBoxAsset(kind, size), ...rewardBoxDimensions[kind][size] };
}

export function normalizeRewardBoxKind(kind: string): RewardBoxKind {
  return kind === 'golden' || kind === 'legendary' ? kind : 'standard';
}
