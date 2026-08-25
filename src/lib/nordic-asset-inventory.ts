export const nordicAssetPaths = {
  brand: {
    mark: 'brand/brand-mark.svg',
    crossFi: 'brand/brand-cross-fi.svg',
    crossSv: 'brand/brand-cross-sv.svg',
    languageFi: 'brand/language-corner-fi.svg',
    languageSv: 'brand/language-corner-sv.svg',
  },
  rarity: {
    common: 'rarity/frame-common.svg',
    rare: 'rarity/frame-rare.svg',
    epic: 'rarity/frame-epic.svg',
    legendary: 'rarity/frame-legendary.svg',
  },
  achievements: {
    'first-item': 'achievements/first-item.svg',
    'items-10': 'achievements/items-10.svg',
    'items-100': 'achievements/items-100.svg',
    'items-500': 'achievements/items-500.svg',
    'days-3': 'achievements/days-3.svg',
    'days-10': 'achievements/days-10.svg',
    'streak-3': 'achievements/streak-3.svg',
    'streak-7': 'achievements/streak-7.svg',
    'xp-100': 'achievements/xp-100.svg',
    'xp-1000': 'achievements/xp-1000.svg',
    'modes-3': 'achievements/modes-3.svg',
    'active-60': 'achievements/active-60.svg',
  },
  leagues: {
    bronze: 'league/bronze.svg',
    silver: 'league/silver.svg',
    gold: 'league/gold.svg',
    platinum: 'league/platinum.svg',
    diamond: 'league/diamond.svg',
    master: 'league/master.svg',
  },
  decks: {
    anatomi: 'deck-icons/anatomy.svg',
    sjukdomar: 'deck-icons/diseases.svg',
    'forsta-hjalpen': 'deck-icons/first-aid.svg',
    mediciner: 'deck-icons/medicines.svg',
    avdelningar: 'deck-icons/departments.svg',
    'vastaanotto-anamneesi': 'deck-icons/anamnesis.svg',
    'tutkimukset-hoito': 'deck-icons/examinations.svg',
    laboratoriokokeet: 'deck-icons/laboratory.svg',
  },
} as const;

type NestedStrings<T> = T extends string ? T : { [K in keyof T]: NestedStrings<T[K]> }[keyof T];
export type NordicAssetPath = NestedStrings<typeof nordicAssetPaths>;

export function flattenNordicAssetPaths(): NordicAssetPath[] {
  return Object.values(nordicAssetPaths).flatMap((category) => Object.values(category)) as NordicAssetPath[];
}
