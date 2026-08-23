export const rewardVisualAssetPaths = {
  hud: 'reward-hud.svg',
  standard: 'reward-standard.svg',
  golden: 'reward-golden.svg',
  legendary: 'reward-legendary.svg',
} as const;

export function flattenRewardVisualAssetPaths(): string[] {
  return Object.values(rewardVisualAssetPaths);
}
