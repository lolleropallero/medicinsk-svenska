export const visualFixAssetPaths = {
  rewards: {
    hud: 'rewards/box-hud.svg',
    standard: 'rewards/box-standard.svg',
    golden: 'rewards/box-golden.svg',
    legendary: 'rewards/box-legendary.svg',
  },
  descriptionCategories: {
    'solut-kudokset-iho': 'category-icons/cells.svg',
    'luusto-nivelet-lihakset': 'category-icons/skeleton.svg',
    'hermosto-aistit': 'category-icons/neuro.svg',
    'verenkierto-hengitys': 'category-icons/cardio.svg',
    'veri-imunestejarjestelma': 'category-icons/blood.svg',
    'ruoansulatus-virtsatiet': 'category-icons/digestion.svg',
    'lisaantyminen-hormonit': 'category-icons/hormones.svg',
  },
  backgrounds: {
    homeDark: 'backgrounds/home-dark.webp',
    rewardsDark: 'backgrounds/rewards-dark.webp',
    shellLight: 'backgrounds/shell-light.webp',
    studyLight: 'backgrounds/study-light.webp',
  },
} as const;

export function flattenVisualFixAssetPaths(): string[] {
  return Object.values(visualFixAssetPaths).flatMap((category) => Object.values(category));
}
