export const standardBoxV5AssetPaths = {
  hud: 'box-standard-hud.png',
  card: 'box-standard-card.png',
  hero: 'box-standard-hero.png',
} as const;

export function flattenStandardBoxV5AssetPaths(): string[] {
  return Object.values(standardBoxV5AssetPaths);
}
