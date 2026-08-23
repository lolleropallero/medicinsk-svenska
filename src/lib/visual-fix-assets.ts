import cellsUrl from '../assets/visual-fix-v4/category-icons/cells.svg?url';
import skeletonUrl from '../assets/visual-fix-v4/category-icons/skeleton.svg?url';
import neuroUrl from '../assets/visual-fix-v4/category-icons/neuro.svg?url';
import cardioUrl from '../assets/visual-fix-v4/category-icons/cardio.svg?url';
import bloodUrl from '../assets/visual-fix-v4/category-icons/blood.svg?url';
import digestionUrl from '../assets/visual-fix-v4/category-icons/digestion.svg?url';
import hormonesUrl from '../assets/visual-fix-v4/category-icons/hormones.svg?url';
import homeDarkUrl from '../assets/visual-fix-v4/backgrounds/home-dark.webp?url';
import rewardsDarkUrl from '../assets/visual-fix-v4/backgrounds/rewards-dark.webp?url';
import shellLightUrl from '../assets/visual-fix-v4/backgrounds/shell-light.webp?url';
import studyLightUrl from '../assets/visual-fix-v4/backgrounds/study-light.webp?url';

export const visualFixAssets = {
  descriptionCategories: {
    'solut-kudokset-iho': cellsUrl,
    'luusto-nivelet-lihakset': skeletonUrl,
    'hermosto-aistit': neuroUrl,
    'verenkierto-hengitys': cardioUrl,
    'veri-imunestejarjestelma': bloodUrl,
    'ruoansulatus-virtsatiet': digestionUrl,
    'lisaantyminen-hormonit': hormonesUrl,
  },
  backgrounds: {
    homeDark: homeDarkUrl,
    rewardsDark: rewardsDarkUrl,
    shellLight: shellLightUrl,
    studyLight: studyLightUrl,
  },
} as const;

export type BackgroundKind = keyof typeof visualFixAssets.backgrounds;
