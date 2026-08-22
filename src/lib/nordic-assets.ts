import { nordicAssetPaths, type NordicAssetPath } from './nordic-asset-inventory';

const modules = import.meta.glob('../assets/nordic-v1/**/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function url(path: NordicAssetPath): string {
  const resolved = modules[`../assets/nordic-v1/${path}`];
  if (!resolved) throw new Error(`Missing mapped Nordic asset: ${path}`);
  return resolved;
}

function mapCategory<T extends Record<string, NordicAssetPath>>(category: T): { readonly [K in keyof T]: string } {
  return Object.fromEntries(Object.entries(category).map(([key, path]) => [key, url(path)])) as { readonly [K in keyof T]: string };
}

export const nordicAssets = {
  brand: mapCategory(nordicAssetPaths.brand),
  backgrounds: mapCategory(nordicAssetPaths.backgrounds),
  rewardBoxes: mapCategory(nordicAssetPaths.rewardBoxes),
  rewardPrimitives: mapCategory(nordicAssetPaths.rewardPrimitives),
  rarity: mapCategory(nordicAssetPaths.rarity),
  achievements: mapCategory(nordicAssetPaths.achievements),
  leagues: mapCategory(nordicAssetPaths.leagues),
  decks: mapCategory(nordicAssetPaths.decks),
} as const;

export type RewardBoxKind = keyof typeof nordicAssets.rewardBoxes;
export type RarityKind = keyof typeof nordicAssets.rarity;
export type AchievementAssetId = keyof typeof nordicAssets.achievements;
export type LeagueAssetTier = keyof typeof nordicAssets.leagues;
export type DeckAssetId = keyof typeof nordicAssets.decks;

export function mappedAsset<T extends Record<string, string>>(mapping: T, key: string): T[keyof T] | undefined {
  return Object.prototype.hasOwnProperty.call(mapping, key) ? mapping[key as keyof T] : undefined;
}
