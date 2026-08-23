import rewardHudUrl from '../assets/rewards-kruunu-kilpi/reward-hud.svg?url';
import rewardStandardUrl from '../assets/rewards-kruunu-kilpi/reward-standard.svg?url';
import rewardGoldenUrl from '../assets/rewards-kruunu-kilpi/reward-golden.svg?url';
import rewardLegendaryUrl from '../assets/rewards-kruunu-kilpi/reward-legendary.svg?url';

export type RewardBoxKind = 'standard' | 'golden' | 'legendary';
export type RewardBoxSize = 'small' | 'normal' | 'large';

export const rewardBoxAssets = {
  standard: {
    small: rewardHudUrl,
    normal: rewardStandardUrl,
    large: rewardStandardUrl,
  },
  golden: { small: rewardGoldenUrl, normal: rewardGoldenUrl, large: rewardGoldenUrl },
  legendary: { small: rewardLegendaryUrl, normal: rewardLegendaryUrl, large: rewardLegendaryUrl },
} as const satisfies Record<RewardBoxKind, Record<RewardBoxSize, string>>;

const rewardBoxDimensions = {
  standard: {
    small: { width: 120, height: 132 },
    normal: { width: 320, height: 360 },
    large: { width: 320, height: 360 },
  },
  golden: {
    small: { width: 400, height: 420 },
    normal: { width: 400, height: 420 },
    large: { width: 400, height: 420 },
  },
  legendary: {
    small: { width: 400, height: 440 },
    normal: { width: 400, height: 440 },
    large: { width: 400, height: 440 },
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
