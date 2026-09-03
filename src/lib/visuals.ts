import { mappedAsset, nordicAssets } from "./nordic-assets";
import { COSMETICS, DEFAULT_COSMETICS } from "./progress/catalog";
import type { Cosmetic, CosmeticType } from "./progress/types";
import { rewardBoxAsset } from "./reward-box-assets";

export const ICON_PATHS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/>',
  flashcards:
    '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M3 7v12a2 2 0 0 0 2 2"/>',
  phrases:
    '<path d="M4 5h11a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4H9l-5 4v-4a4 4 0 0 1-2-3.5V9a4 4 0 0 1 2-4Z"/><path d="M7 9h7M7 12h5"/>',
  descriptions:
    '<path d="M9 3h6v3H9zM7 5H5v16h14V5h-2M8 11h8M8 15h5"/><path d="m14 18 1.5 1.5L19 16"/>',
  progress: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  streak:
    '<rect x="4" y="4.5" width="16" height="15.5" rx="3"/><path d="M11.5 8h4.5M11.5 12h4.5M11.5 16h4.5"/><path d="m7 8 1 1 2-2M7 12l1 1 2-2M7 16l1 1 2-2"/>',
  level:
    '<path d="m12 3 2.7 5.5 6 .9-4.4 4.2 1.1 6-5.4-2.8-5.4 2.8 1.1-6-4.4-4.2 6-.9L12 3Z"/>',
  credits:
    '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5c-.8-.7-1.8-1-3-1-1.7 0-3 .8-3 2s1 1.8 3 2.3c2 .5 3 1.1 3 2.4 0 1.3-1.3 2.3-3.2 2.3-1.4 0-2.6-.4-3.5-1.2M12 5.5v13"/>',
  shop: '<path d="M4 10v10h16V10M3 10l2-6h14l2 6"/><path d="M3 10c0 2 3 3 4.5 1 1 2 4 2 4.5 0 1 2 4 2 4.5 0 1.5 2 4.5 1 4.5-1M9 20v-5h6v5"/>',
  collection: '<path d="M4 4h6v7H4zM14 4h6v7h-6zM4 15h6v5H4zM14 15h6v5h-6z"/>',
  season:
    '<path d="M5 20c2-6 4-9 7-11 2-1.5 4-2 7-4"/><circle cx="5" cy="20" r="2"/><circle cx="12" cy="9" r="2"/><circle cx="19" cy="5" r="2"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  check: '<path d="m4 13 5 5L20 6"/>',
  shuffle:
    '<path d="M4 7h3c5 0 5 10 10 10h3M17 4l3 3-3 3M4 17h3c1.5 0 2.5-.9 3.4-2M17 14l3 3-3 3"/>',
  retry: '<path d="M20 7v5h-5M19 12a7 7 0 1 0-1.5 5"/>',
  gift: '<path d="M4 9h16v12H4zM3 6h18v4H3zM12 6v15M9 6C6 6 6 2 8.5 3.2 10 4 12 6 12 6M15.5 3.2C18 2 18 6 15 6h-3s2-2 3.5-2.8Z"/>',
  theme:
    '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18c2 0 3-1.5 2-3s0-3 2-3h2.5A9 9 0 0 0 12 3Z"/><circle cx="7.5" cy="10" r=".6"/><circle cx="10" cy="6.5" r=".6"/><circle cx="15" cy="7.5" r=".6"/>',
  cardStyle:
    '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  title:
    '<path d="M5 4h14v5c0 4-3 7-7 7s-7-3-7-7V4Z"/><path d="M8 20h8M12 16v4M5 7H2v2c0 2 1.5 3 4 3M19 7h3v2c0 2-1.5 3-4 3"/>',
  progressFrame:
    '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 16V9M12 16V6M17 16v-4"/>',
  heartLungs:
    '<path d="M12 21V8M11 9C9 5 5 5 4 9v7c0 3 4 4 7 2M13 9c2-4 6-4 7 0v7c0 3-4 4-7 2"/><path d="M12 8V3"/>',
  arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  close: '<path d="M5 5l14 14M19 5 5 19"/>',
  spark:
    '<path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z"/>',
  route:
    '<path d="M4 19c3-7 5-10 9-11 2-.5 4 0 7-3"/><circle cx="4" cy="19" r="2"/><circle cx="13" cy="8" r="2"/><circle cx="20" cy="5" r="2"/>',
  dialogue:
    '<rect x="3" y="4" width="14" height="10" rx="3"/><rect x="7" y="10" width="14" height="10" rx="3"/>',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function resolveIcon(name: string): IconName {
  return Object.prototype.hasOwnProperty.call(ICON_PATHS, name)
    ? (name as IconName)
    : "spark";
}

export function iconSvg(
  name: string,
  size: number = 24,
  label?: string,
): string {
  const icon = resolveIcon(name);
  const aria = label
    ? `role="img" aria-label="${label.replace(/[&<>\"]/g, "")}"`
    : 'aria-hidden="true"';
  return `<svg class="app-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" ${aria}>${ICON_PATHS[icon]}</svg>`;
}

export const MOBILE_NAV_ITEMS = [
  { href: "/", label: "Etusivu", icon: "home" },
  { href: "/kortit/", label: "Kortit", icon: "flashcards" },
  { href: "/fraasit/", label: "Fraasit", icon: "phrases" },
  { href: "/kuvailu/", label: "Kuvailu", icon: "descriptions" },
  { href: "/tilanteet/", label: "Tilanteet", icon: "dialogue" },
  { href: "/edistyminen/", label: "Framsteg", icon: "progress" },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: IconName;
}>;

export const ACHIEVEMENT_BADGES = nordicAssets.achievements;

export function achievementBadge(id: string) {
  return mappedAsset(ACHIEVEMENT_BADGES, id);
}

export const LEAGUE_BADGES = {
  Pronssi: {
    label: "Brons",
    className: "bronze",
    asset: nordicAssets.leagues.bronze,
  },
  Hopea: {
    label: "Silver",
    className: "silver",
    asset: nordicAssets.leagues.silver,
  },
  Kulta: { label: "Guld", className: "gold", asset: nordicAssets.leagues.gold },
  Platina: {
    label: "Platina",
    className: "platinum",
    asset: nordicAssets.leagues.platinum,
  },
  Timantti: {
    label: "Diamant",
    className: "diamond",
    asset: nordicAssets.leagues.diamond,
  },
  Konsultti: {
    label: "Mästare",
    className: "master",
    asset: nordicAssets.leagues.master,
  },
} as const;

export function leagueBadge(tier: string) {
  return (
    LEAGUE_BADGES[tier as keyof typeof LEAGUE_BADGES] ?? LEAGUE_BADGES.Pronssi
  );
}

export const REWARD_BOX_VARIANTS = {
  standard: {
    label: "Vanlig belöning",
    className: "standard",
    asset: rewardBoxAsset("standard", "normal"),
  },
  golden: {
    label: "Gyllene belöning",
    className: "golden",
    asset: rewardBoxAsset("golden", "normal"),
  },
  legendary: {
    label: "Legendarisk belöning",
    className: "legendary",
    asset: rewardBoxAsset("legendary", "normal"),
  },
} as const;

export function rewardBoxVariant(kind: string) {
  return (
    REWARD_BOX_VARIANTS[kind as keyof typeof REWARD_BOX_VARIANTS] ??
    REWARD_BOX_VARIANTS.standard
  );
}

export const RARITY_VARIANTS = {
  common: {
    label: "Vanlig",
    className: "common",
    asset: nordicAssets.rarity.common,
  },
  rare: {
    label: "Sällsynt",
    className: "rare",
    asset: nordicAssets.rarity.rare,
  },
  epic: { label: "Episk", className: "epic", asset: nordicAssets.rarity.epic },
  legendary: {
    label: "Legendarisk",
    className: "legendary",
    asset: nordicAssets.rarity.legendary,
  },
} as const;

export function rarityVariant(rarity: string) {
  return (
    RARITY_VARIANTS[rarity as keyof typeof RARITY_VARIANTS] ??
    RARITY_VARIANTS.common
  );
}

export function languageRibbon(direction: string, side: "source" | "target") {
  const fiSource = direction !== "sv-fi";
  const language =
    side === "source" ? (fiSource ? "fi" : "sv") : fiSource ? "sv" : "fi";
  return { language, className: `language-${language}` };
}

const cosmeticById = new Map(COSMETICS.map((item) => [item.id, item]));
export type VisualCosmeticType = CosmeticType;

type CosmeticCssVariables = Record<`--${string}`, string>;

export interface CosmeticVisualDefinition {
  id: string;
  type: VisualCosmeticType;
  motif: string;
  css: CosmeticCssVariables;
}

const basePreview = {
  "--cosmetic-bg": "#f5f9fd",
  "--cosmetic-surface": "#ffffff",
  "--cosmetic-surface-2": "#e5f1fa",
  "--cosmetic-accent": "#006aa7",
  "--cosmetic-accent-2": "#fecc02",
  "--cosmetic-text": "#12263a",
  "--cosmetic-muted": "#5b7084",
  "--cosmetic-border": "#c7dae9",
  "--cosmetic-pattern": "none",
  "--cosmetic-radius": "16px",
  "--cosmetic-band": "linear-gradient(90deg,#006aa7,#003580)",
  "--cosmetic-line": "solid",
} as const satisfies CosmeticCssVariables;

const theme = (
  id: string,
  motif: string,
  css: CosmeticCssVariables,
): CosmeticVisualDefinition => ({
  id,
  type: "theme",
  motif,
  css: { ...basePreview, ...css },
});

const card = (
  id: string,
  motif: string,
  css: CosmeticCssVariables,
): CosmeticVisualDefinition => ({
  id,
  type: "cardStyle",
  motif,
  css: {
    ...basePreview,
    "--card-pattern": "none",
    "--card-radius": "21px",
    "--card-border-color": "#bfd4e3",
    "--card-border-width": "1px",
    "--card-border-style": "solid",
    "--card-surface": "var(--cream)",
    "--card-shadow": "var(--shadow)",
    "--card-accent": "var(--sv-blue)",
    "--card-ornament": "none",
    "--card-corner-size": "0px",
    "--card-top-band": "transparent",
    "--card-inner-border": "transparent",
    "--card-type-spacing": "0",
    ...css,
  },
});

const frame = (
  id: string,
  motif: string,
  css: CosmeticCssVariables,
): CosmeticVisualDefinition => ({
  id,
  type: "progressFrame",
  motif,
  css: {
    ...basePreview,
    "--frame-color": "#003580",
    "--passport-frame-border": "2px solid var(--frame-color)",
    "--passport-frame-inner": "linear-gradient(135deg,rgba(255,255,255,.1),rgba(255,255,255,.02))",
    "--passport-frame-pattern": "none",
    "--passport-frame-radius": "24px",
    "--passport-frame-shadow": "var(--shadow-deep)",
    "--passport-frame-corner": "transparent",
    "--passport-frame-accent": "var(--sv-yellow)",
    "--passport-frame-outline": "0 0 0 0 transparent",
    ...css,
  },
});

const title = (
  id: string,
  motif: string,
  css: CosmeticCssVariables,
): CosmeticVisualDefinition => ({
  id,
  type: "title",
  motif,
  css: {
    ...basePreview,
    "--title-accent": "#006aa7",
    "--title-bg": "linear-gradient(180deg,#ffffff,#e5f1fa)",
    "--title-border": "#c7dae9",
    "--title-text": "#12263a",
    ...css,
  },
});

export const COSMETIC_VISUALS = {
  "theme-default": theme("theme-default", "triage", {
    "--background": "#f5f9fd",
    "--snow": "#f5f9fd",
    "--ice": "#e5f1fa",
    "--cream": "#fffaf0",
    "--surface": "#ffffff",
    "--text": "#12263a",
    "--muted": "#506579",
    "--border": "#c7dae9",
    "--fi-blue": "#003580",
    "--sv-blue": "#006aa7",
    "--nordic-navy": "#0b213b",
    "--nordic-navy-deep": "#06162a",
    "--frame-color": "#003580",
    "--shell-surface": "rgba(6,22,42,.82)",
    "--study-surface": "#fffaf0",
    "--theme-motif": "linear-gradient(90deg,transparent 0 43%,rgba(0,106,167,.08) 43% 57%,transparent 57%)",
  }),
  "theme-1": theme("theme-1", "theatre", {
    "--background": "#eef8f9",
    "--snow": "#eef8f9",
    "--ice": "#dff1f3",
    "--cream": "#f7fffd",
    "--surface": "#fbffff",
    "--text": "#12343d",
    "--muted": "#4c6f76",
    "--border": "#afd1d4",
    "--fi-blue": "#06478f",
    "--sv-blue": "#087f9f",
    "--nordic-navy": "#08323e",
    "--nordic-navy-deep": "#041b24",
    "--frame-color": "#0b8ea2",
    "--shell-surface": "rgba(5,42,52,.9)",
    "--study-surface": "#f7fffd",
    "--theme-motif": "linear-gradient(135deg,rgba(8,127,159,.1) 25%,transparent 25% 50%,rgba(8,127,159,.1) 50% 75%,transparent 75%)",
    "--cosmetic-bg": "#dff1f3",
    "--cosmetic-accent": "#087f9f",
    "--cosmetic-accent-2": "#7fd2d4",
    "--cosmetic-band": "linear-gradient(90deg,#087f9f,#06478f)",
  }),
  "theme-2": theme("theme-2", "archive", {
    "--background": "#fbf3df",
    "--snow": "#fbf3df",
    "--ice": "#f0e2c1",
    "--cream": "#fff8e8",
    "--surface": "#fffaf0",
    "--text": "#2d291f",
    "--muted": "#6c604c",
    "--border": "#d8c497",
    "--fi-blue": "#244d70",
    "--sv-blue": "#8b6a32",
    "--nordic-navy": "#332817",
    "--nordic-navy-deep": "#21180c",
    "--frame-color": "#9d7433",
    "--shell-surface": "rgba(51,40,23,.9)",
    "--study-surface": "#fff8e8",
    "--theme-motif": "repeating-linear-gradient(0deg,rgba(157,116,51,.09) 0 1px,transparent 1px 24px)",
    "--cosmetic-bg": "#f0e2c1",
    "--cosmetic-accent": "#8b6a32",
    "--cosmetic-accent-2": "#244d70",
    "--cosmetic-band": "linear-gradient(90deg,#8b6a32,#244d70)",
  }),
  "theme-3": theme("theme-3", "night", {
    "--background": "#07172c",
    "--snow": "#0b213b",
    "--ice": "#102c4e",
    "--cream": "#122b48",
    "--surface": "#102b4b",
    "--text": "#f7fbff",
    "--muted": "#c9dbe8",
    "--border": "#36597b",
    "--fi-blue": "#6eb5ff",
    "--sv-blue": "#1ba0d0",
    "--nordic-navy": "#091c33",
    "--nordic-navy-deep": "#04101f",
    "--frame-color": "#fecc02",
    "--shell-surface": "rgba(4,16,31,.92)",
    "--study-surface": "#122b48",
    "--theme-motif": "radial-gradient(circle at 78% 22%,rgba(254,204,2,.16),transparent 22%),linear-gradient(180deg,rgba(110,181,255,.08),transparent)",
    "--cosmetic-bg": "#07172c",
    "--cosmetic-surface": "#102b4b",
    "--cosmetic-surface-2": "#173f68",
    "--cosmetic-accent": "#6eb5ff",
    "--cosmetic-accent-2": "#fecc02",
    "--cosmetic-text": "#f7fbff",
    "--cosmetic-muted": "#c9dbe8",
    "--cosmetic-border": "#36597b",
    "--cosmetic-band": "linear-gradient(90deg,#102b4b,#1ba0d0)",
  }),
  "theme-4": theme("theme-4", "lab", {
    "--background": "#eef8ff",
    "--snow": "#eef8ff",
    "--ice": "#dff2fb",
    "--cream": "#f8fcff",
    "--surface": "#ffffff",
    "--text": "#102a42",
    "--muted": "#496a80",
    "--border": "#b8d7e9",
    "--fi-blue": "#00529b",
    "--sv-blue": "#1589bd",
    "--nordic-navy": "#092843",
    "--nordic-navy-deep": "#041725",
    "--frame-color": "#20a9c0",
    "--shell-surface": "rgba(4,31,52,.88)",
    "--study-surface": "#f8fcff",
    "--theme-motif": "radial-gradient(circle,rgba(21,137,189,.13) 1px,transparent 2px)",
    "--cosmetic-bg": "#dff2fb",
    "--cosmetic-accent": "#1589bd",
    "--cosmetic-accent-2": "#20a9c0",
    "--cosmetic-band": "linear-gradient(90deg,#00529b,#20a9c0)",
  }),
  "theme-5": theme("theme-5", "rehab", {
    "--background": "#f0f8f3",
    "--snow": "#f0f8f3",
    "--ice": "#dfeee5",
    "--cream": "#fbfff8",
    "--surface": "#ffffff",
    "--text": "#17342c",
    "--muted": "#526f62",
    "--border": "#b8d4c2",
    "--fi-blue": "#1a5b62",
    "--sv-blue": "#287f70",
    "--nordic-navy": "#0d2b2e",
    "--nordic-navy-deep": "#071b1d",
    "--frame-color": "#5b9c76",
    "--shell-surface": "rgba(7,38,36,.88)",
    "--study-surface": "#fbfff8",
    "--theme-motif": "linear-gradient(120deg,transparent 0 42%,rgba(40,127,112,.1) 42% 48%,transparent 48%)",
    "--cosmetic-bg": "#dfeee5",
    "--cosmetic-accent": "#287f70",
    "--cosmetic-accent-2": "#8ebf87",
    "--cosmetic-band": "linear-gradient(90deg,#1a5b62,#5b9c76)",
  }),
  "theme-6": theme("theme-6", "clinic", {
    "--background": "#f3f6f8",
    "--snow": "#f3f6f8",
    "--ice": "#e7edf1",
    "--cream": "#fbfcfd",
    "--surface": "#ffffff",
    "--text": "#182938",
    "--muted": "#596b7a",
    "--border": "#c2d0d9",
    "--fi-blue": "#304c67",
    "--sv-blue": "#52788f",
    "--nordic-navy": "#162a3b",
    "--nordic-navy-deep": "#0b1824",
    "--frame-color": "#63798c",
    "--shell-surface": "rgba(22,42,59,.9)",
    "--study-surface": "#fbfcfd",
    "--theme-motif": "linear-gradient(90deg,rgba(48,76,103,.08) 1px,transparent 1px)",
    "--cosmetic-bg": "#e7edf1",
    "--cosmetic-accent": "#52788f",
    "--cosmetic-accent-2": "#93a7b4",
    "--cosmetic-band": "linear-gradient(90deg,#304c67,#6f8797)",
  }),
  "theme-7": theme("theme-7", "consult", {
    "--background": "#edf3fa",
    "--snow": "#edf3fa",
    "--ice": "#dfe9f4",
    "--cream": "#f7fbff",
    "--surface": "#ffffff",
    "--text": "#10233a",
    "--muted": "#506986",
    "--border": "#b8cadd",
    "--fi-blue": "#132f63",
    "--sv-blue": "#194879",
    "--nordic-navy": "#071b36",
    "--nordic-navy-deep": "#041224",
    "--frame-color": "#fecc02",
    "--shell-surface": "rgba(4,18,36,.92)",
    "--study-surface": "#f7fbff",
    "--theme-motif": "linear-gradient(135deg,rgba(19,47,99,.11) 0 16%,transparent 16% 34%,rgba(25,72,121,.1) 34% 50%,transparent 50%)",
    "--cosmetic-bg": "#dfe9f4",
    "--cosmetic-accent": "#194879",
    "--cosmetic-accent-2": "#fecc02",
    "--cosmetic-band": "linear-gradient(90deg,#132f63,#194879)",
  }),
  "theme-8": theme("theme-8", "anatomy", {
    "--background": "#fbf1f2",
    "--snow": "#fbf1f2",
    "--ice": "#f1dfe2",
    "--cream": "#fff8f5",
    "--surface": "#ffffff",
    "--text": "#3a1f27",
    "--muted": "#765962",
    "--border": "#dbbdc2",
    "--fi-blue": "#744754",
    "--sv-blue": "#a45964",
    "--nordic-navy": "#351923",
    "--nordic-navy-deep": "#1f0e14",
    "--frame-color": "#bd7c6d",
    "--shell-surface": "rgba(53,25,35,.9)",
    "--study-surface": "#fff8f5",
    "--theme-motif": "radial-gradient(ellipse at 22% 80%,rgba(164,89,100,.12),transparent 34%),linear-gradient(110deg,transparent 0 60%,rgba(116,71,84,.09) 60%)",
    "--cosmetic-bg": "#f1dfe2",
    "--cosmetic-accent": "#a45964",
    "--cosmetic-accent-2": "#bd7c6d",
    "--cosmetic-band": "linear-gradient(90deg,#744754,#a45964)",
  }),
  "theme-9": theme("theme-9", "followup", {
    "--background": "#f6f7f5",
    "--snow": "#f6f7f5",
    "--ice": "#e9eeec",
    "--cream": "#fffdf6",
    "--surface": "#ffffff",
    "--text": "#24302f",
    "--muted": "#63706e",
    "--border": "#c8d2cf",
    "--fi-blue": "#315d68",
    "--sv-blue": "#5c7f86",
    "--nordic-navy": "#1b3235",
    "--nordic-navy-deep": "#101f21",
    "--frame-color": "#6a8c86",
    "--shell-surface": "rgba(27,50,53,.9)",
    "--study-surface": "#fffdf6",
    "--theme-motif": "repeating-linear-gradient(90deg,rgba(49,93,104,.08) 0 1px,transparent 1px 28px)",
    "--cosmetic-bg": "#e9eeec",
    "--cosmetic-accent": "#5c7f86",
    "--cosmetic-accent-2": "#a6b28d",
    "--cosmetic-band": "linear-gradient(90deg,#315d68,#6a8c86)",
  }),
  "season-legendary": theme("season-legendary", "chief", {
    "--background": "#eef4fb",
    "--snow": "#eef4fb",
    "--ice": "#dde9f4",
    "--cream": "#f7fbff",
    "--surface": "#ffffff",
    "--text": "#10213a",
    "--muted": "#506a86",
    "--border": "#b6c9dd",
    "--fi-blue": "#173e87",
    "--sv-blue": "#076f9f",
    "--nordic-navy": "#090e2d",
    "--nordic-navy-deep": "#050818",
    "--frame-color": "#e49a00",
    "--shell-surface": "rgba(5,8,24,.94)",
    "--study-surface": "#f7fbff",
    "--theme-motif": "linear-gradient(120deg,transparent 0 46%,rgba(228,154,0,.16) 46% 50%,transparent 50%),radial-gradient(circle at 82% 18%,rgba(7,111,159,.18),transparent 24%)",
    "--cosmetic-bg": "#dde9f4",
    "--cosmetic-accent": "#173e87",
    "--cosmetic-accent-2": "#e49a00",
    "--cosmetic-band": "linear-gradient(90deg,#090e2d,#076f9f,#e49a00)",
  }),

  "cardStyle-default": card("cardStyle-default", "plain", {}),
  "cardStyle-1": card("cardStyle-1", "prescription", {
    "--card-pattern": "repeating-linear-gradient(transparent 0 30px,rgba(0,53,128,.09) 30px 31px)",
    "--card-accent": "#197ec1",
    "--card-top-band": "linear-gradient(90deg,rgba(25,126,193,.2),transparent)",
    "--cosmetic-pattern": "repeating-linear-gradient(transparent 0 14px,rgba(25,126,193,.22) 14px 15px)",
  }),
  "cardStyle-2": card("cardStyle-2", "form", {
    "--card-pattern": "linear-gradient(90deg,rgba(0,106,167,.08) 1px,transparent 1px),linear-gradient(rgba(0,106,167,.08) 1px,transparent 1px)",
    "--card-radius": "16px",
    "--card-inner-border": "rgba(0,106,167,.18)",
    "--card-accent": "#006aa7",
    "--cosmetic-pattern": "linear-gradient(90deg,rgba(0,106,167,.22) 1px,transparent 1px),linear-gradient(rgba(0,106,167,.2) 1px,transparent 1px)",
  }),
  "cardStyle-3": card("cardStyle-3", "note", {
    "--card-surface": "#fff8e8",
    "--card-border-color": "#d8c497",
    "--card-pattern": "radial-gradient(circle at 14% 12%,rgba(254,204,2,.16),transparent 25%)",
    "--card-radius": "23px",
    "--card-accent": "#9d7433",
    "--cosmetic-bg": "#f4e7c8",
    "--cosmetic-accent": "#9d7433",
    "--cosmetic-pattern": "radial-gradient(circle at 14% 12%,rgba(157,116,51,.28),transparent 30%)",
  }),
  "cardStyle-4": card("cardStyle-4", "exam", {
    "--card-border-width": "2px",
    "--card-radius": "12px",
    "--card-inner-border": "rgba(0,53,128,.28)",
    "--card-accent": "#003580",
    "--cosmetic-line": "double",
  }),
  "cardStyle-5": card("cardStyle-5", "journal", {
    "--card-top-band": "linear-gradient(90deg,var(--fi-blue),var(--sv-blue))",
    "--card-pattern": "linear-gradient(135deg,transparent 72%,rgba(0,53,128,.09) 72%)",
    "--card-accent": "#003580",
    "--cosmetic-band": "linear-gradient(90deg,#003580,#006aa7)",
  }),
  "cardStyle-6": card("cardStyle-6", "control", {
    "--card-radius": "8px",
    "--card-border-color": "#304c67",
    "--card-border-width": "2px",
    "--card-accent": "#304c67",
    "--card-corner-size": "24px",
    "--cosmetic-radius": "8px",
  }),
  "cardStyle-7": card("cardStyle-7", "story", {
    "--card-radius": "28px",
    "--card-type-spacing": ".03em",
    "--card-pattern": "linear-gradient(180deg,rgba(255,255,255,.55),transparent)",
    "--card-accent": "#287f70",
    "--cosmetic-radius": "24px",
    "--cosmetic-accent": "#287f70",
  }),
  "cardStyle-8": card("cardStyle-8", "imaging", {
    "--card-surface": "var(--cream)",
    "--card-border-color": "#56a5ff",
    "--card-border-width": "3px",
    "--card-pattern": "linear-gradient(145deg,rgba(6,22,42,.18),transparent),radial-gradient(circle at 80% 28%,rgba(86,165,255,.18),transparent 24%)",
    "--card-accent": "#56a5ff",
    "--cosmetic-bg": "#07172c",
    "--cosmetic-surface": "#122b48",
    "--cosmetic-text": "#f7fbff",
    "--cosmetic-muted": "#c9dbe8",
    "--cosmetic-border": "#36597b",
    "--cosmetic-accent": "#56a5ff",
  }),
  "cardStyle-9": card("cardStyle-9", "referral", {
    "--card-pattern": "repeating-linear-gradient(0deg,transparent 0 25px,rgba(49,93,104,.08) 25px 26px),linear-gradient(90deg,rgba(49,93,104,.14) 0 22%,transparent 22%)",
    "--card-accent": "#315d68",
    "--card-inner-border": "rgba(49,93,104,.16)",
    "--cosmetic-accent": "#315d68",
    "--cosmetic-pattern": "linear-gradient(90deg,rgba(49,93,104,.22) 0 22%,transparent 22%),repeating-linear-gradient(0deg,transparent 0 13px,rgba(49,93,104,.16) 13px 14px)",
  }),
  "season-epic-2": card("season-epic-2", "clinical", {
    "--card-pattern": "linear-gradient(125deg,transparent 0 70%,rgba(120,87,198,.16) 70%),radial-gradient(circle at 10% 85%,rgba(254,204,2,.18),transparent 26%)",
    "--card-radius": "24px",
    "--card-border-color": "#7857c6",
    "--card-border-width": "2px",
    "--card-accent": "#7857c6",
    "--card-top-band": "linear-gradient(90deg,#173e87,#7857c6,#e49a00)",
    "--cosmetic-bg": "#ece7ff",
    "--cosmetic-accent": "#7857c6",
    "--cosmetic-accent-2": "#e49a00",
    "--cosmetic-band": "linear-gradient(90deg,#173e87,#7857c6,#e49a00)",
  }),

  "progressFrame-default": frame("progressFrame-default", "base", {}),
  "progressFrame-1": frame("progressFrame-1", "pulse", {
    "--frame-color": "#16845b",
    "--passport-frame-border": "3px solid #16845b",
    "--passport-frame-pattern": "linear-gradient(90deg,transparent 0 12%,rgba(22,132,91,.22) 12% 15%,transparent 15% 24%,rgba(22,132,91,.22) 24% 27%,transparent 27%)",
    "--passport-frame-accent": "#7bc49d",
    "--cosmetic-accent": "#16845b",
    "--cosmetic-pattern": "linear-gradient(90deg,transparent 0 18%,rgba(22,132,91,.28) 18% 21%,transparent 21% 35%,rgba(22,132,91,.28) 35% 39%,transparent 39%)",
  }),
  "progressFrame-2": frame("progressFrame-2", "grid", {
    "--frame-color": "#006aa7",
    "--passport-frame-pattern": "linear-gradient(90deg,rgba(255,255,255,.14) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.14) 1px,transparent 1px)",
    "--passport-frame-inner": "linear-gradient(135deg,rgba(0,106,167,.16),rgba(255,255,255,.04))",
    "--cosmetic-pattern": "linear-gradient(90deg,rgba(0,106,167,.24) 1px,transparent 1px),linear-gradient(rgba(0,106,167,.2) 1px,transparent 1px)",
  }),
  "progressFrame-3": frame("progressFrame-3", "gauge", {
    "--frame-color": "#55768f",
    "--passport-frame-border": "4px double #d8e3eb",
    "--passport-frame-outline": "0 0 0 2px #55768f",
    "--passport-frame-accent": "#fecc02",
    "--cosmetic-line": "double",
    "--cosmetic-accent": "#55768f",
  }),
  "progressFrame-4": frame("progressFrame-4", "followup", {
    "--frame-color": "#7857c6",
    "--passport-frame-border": "3px dashed #bfa6ff",
    "--passport-frame-pattern": "repeating-linear-gradient(135deg,rgba(191,166,255,.12) 0 6px,transparent 6px 14px)",
    "--passport-frame-accent": "#bfa6ff",
    "--cosmetic-line": "dashed",
    "--cosmetic-accent": "#7857c6",
  }),
  "progressFrame-5": frame("progressFrame-5", "rotation", {
    "--frame-color": "#d08400",
    "--passport-frame-radius": "32px",
    "--passport-frame-border": "3px solid #d08400",
    "--passport-frame-pattern": "radial-gradient(circle at 18% 18%,rgba(254,204,2,.2),transparent 18%),radial-gradient(circle at 82% 82%,rgba(254,204,2,.16),transparent 18%)",
    "--passport-frame-accent": "#fecc02",
    "--cosmetic-radius": "22px",
    "--cosmetic-accent": "#d08400",
  }),
  "progressFrame-6": frame("progressFrame-6", "tissue", {
    "--frame-color": "#4f948e",
    "--passport-frame-border": "2px solid rgba(79,148,142,.95)",
    "--passport-frame-shadow": "0 18px 45px rgba(15,80,76,.28),inset 0 0 0 8px rgba(255,255,255,.07)",
    "--passport-frame-pattern": "radial-gradient(ellipse at 24% 36%,rgba(126,194,184,.18),transparent 28%),radial-gradient(ellipse at 75% 68%,rgba(126,194,184,.16),transparent 26%)",
    "--cosmetic-accent": "#4f948e",
    "--cosmetic-pattern": "radial-gradient(ellipse at 24% 36%,rgba(79,148,142,.3),transparent 31%),radial-gradient(ellipse at 75% 68%,rgba(79,148,142,.22),transparent 30%)",
  }),
  "progressFrame-7": frame("progressFrame-7", "spectrum", {
    "--frame-color": "#197ec1",
    "--passport-frame-border": "3px solid transparent",
    "--passport-frame-inner": "linear-gradient(#0b213b,#0b213b) padding-box,linear-gradient(90deg,#197ec1,#287f70,#fecc02,#a45964) border-box",
    "--passport-frame-accent": "#fecc02",
    "--cosmetic-band": "linear-gradient(90deg,#197ec1,#287f70,#fecc02,#a45964)",
  }),
  "progressFrame-8": frame("progressFrame-8", "synthesis", {
    "--frame-color": "#e49a00",
    "--passport-frame-border": "1px solid #ffe783",
    "--passport-frame-outline": "0 0 0 3px rgba(228,154,0,.8),0 0 0 7px rgba(254,204,2,.22)",
    "--passport-frame-pattern": "linear-gradient(135deg,rgba(254,204,2,.14),transparent 34%)",
    "--passport-frame-accent": "#ffe783",
    "--cosmetic-line": "double",
    "--cosmetic-accent": "#e49a00",
  }),
  "progressFrame-9": frame("progressFrame-9", "curve", {
    "--frame-color": "#476d94",
    "--passport-frame-border": "3px solid #476d94",
    "--passport-frame-pattern": "linear-gradient(90deg,rgba(255,255,255,.14) 1px,transparent 1px),radial-gradient(ellipse at 65% 22%,transparent 42%,rgba(254,204,2,.16) 43%,transparent 46%)",
    "--passport-frame-accent": "#fecc02",
    "--cosmetic-pattern": "radial-gradient(ellipse at 65% 22%,transparent 42%,rgba(71,109,148,.35) 43%,transparent 48%)",
    "--cosmetic-accent": "#476d94",
  }),
  "season-epic-1": frame("season-epic-1", "rotation-season", {
    "--frame-color": "#7857c6",
    "--passport-frame-border": "3px solid transparent",
    "--passport-frame-inner": "linear-gradient(#090e2d,#173e87) padding-box,linear-gradient(120deg,#173e87,#7857c6,#e49a00) border-box",
    "--passport-frame-pattern": "linear-gradient(120deg,transparent 0 46%,rgba(228,154,0,.2) 46% 50%,transparent 50%),radial-gradient(circle at 82% 18%,rgba(120,87,198,.24),transparent 24%)",
    "--passport-frame-radius": "30px",
    "--passport-frame-accent": "#e49a00",
    "--cosmetic-bg": "#ece7ff",
    "--cosmetic-accent": "#7857c6",
    "--cosmetic-accent-2": "#e49a00",
    "--cosmetic-band": "linear-gradient(90deg,#173e87,#7857c6,#e49a00)",
  }),

  "title-default": title("title-default", "student", {}),
  "title-1": title("title-1", "practice", {
    "--title-accent": "#197ec1",
    "--title-bg": "linear-gradient(180deg,#ffffff,#e8f6fb)",
    "--cosmetic-accent": "#197ec1",
  }),
  "title-2": title("title-2", "repeat", {
    "--title-accent": "#287f70",
    "--title-bg": "linear-gradient(180deg,#ffffff,#e9f4ef)",
    "--cosmetic-accent": "#287f70",
  }),
  "title-3": title("title-3", "words", {
    "--title-accent": "#9d7433",
    "--title-bg": "linear-gradient(180deg,#fff8e8,#f0e2c1)",
    "--title-border": "#d8c497",
    "--cosmetic-accent": "#9d7433",
  }),
  "title-4": title("title-4", "phrases", {
    "--title-accent": "#006aa7",
    "--title-bg": "linear-gradient(180deg,#ffffff,#dff2fb)",
    "--cosmetic-accent": "#006aa7",
  }),
  "title-5": title("title-5", "describe", {
    "--title-accent": "#315d68",
    "--title-bg": "linear-gradient(180deg,#ffffff,#e9eeec)",
    "--cosmetic-accent": "#315d68",
  }),
  "title-6": title("title-6", "oncall", {
    "--title-accent": "#fecc02",
    "--title-bg": "linear-gradient(180deg,#102b4b,#07172c)",
    "--title-border": "#36597b",
    "--title-text": "#f7fbff",
    "--cosmetic-bg": "#07172c",
    "--cosmetic-surface": "#102b4b",
    "--cosmetic-text": "#f7fbff",
    "--cosmetic-muted": "#c9dbe8",
    "--cosmetic-border": "#36597b",
    "--cosmetic-accent": "#fecc02",
  }),
  "title-7": title("title-7", "clinician", {
    "--title-accent": "#16845b",
    "--title-bg": "linear-gradient(180deg,#ffffff,#edf9f3)",
    "--cosmetic-accent": "#16845b",
  }),
  "title-8": title("title-8", "consultant", {
    "--title-accent": "#7857c6",
    "--title-bg": "linear-gradient(180deg,#ffffff,#ece7ff)",
    "--cosmetic-accent": "#7857c6",
  }),
  "title-9": title("title-9", "builder", {
    "--title-accent": "#e49a00",
    "--title-bg": "linear-gradient(180deg,#fff8d8,#ffffff)",
    "--title-border": "#e0af00",
    "--cosmetic-accent": "#e49a00",
  }),
  "season-rare": title("season-rare", "rotation-title", {
    "--title-accent": "#7857c6",
    "--title-bg": "linear-gradient(180deg,#ffffff,#ece7ff)",
    "--title-border": "#bfa6ff",
    "--cosmetic-bg": "#ece7ff",
    "--cosmetic-accent": "#7857c6",
    "--cosmetic-accent-2": "#e49a00",
    "--cosmetic-band": "linear-gradient(90deg,#173e87,#7857c6,#e49a00)",
  }),
} as const satisfies Record<string, CosmeticVisualDefinition>;
const cosmeticVisualMap: Record<string, CosmeticVisualDefinition> =
  COSMETIC_VISUALS;

const rarityLabel = {
  common: "Vanlig",
  rare: "Sällsynt",
  epic: "Episk",
  legendary: "Legendarisk",
} as const;

const typeLabel = {
  theme: "Tema",
  cardStyle: "Kortstil",
  progressFrame: "Framstegsram",
  title: "Titel",
} as const satisfies Record<CosmeticType, string>;

const htmlEscape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

export function cosmeticVisualToken(
  type: VisualCosmeticType,
  id: string,
): string {
  const item = cosmeticById.get(id);
  return item?.type === type ? id : DEFAULT_COSMETICS[type];
}

export function cosmeticVisualDefinition(
  type: VisualCosmeticType,
  id: string,
): CosmeticVisualDefinition {
  const token = cosmeticVisualToken(type, id);
  return (
    cosmeticVisualMap[token] ?? cosmeticVisualMap[DEFAULT_COSMETICS[type]]!
  );
}

export function cosmeticCssVariables(
  type: VisualCosmeticType,
  id: string,
): CosmeticCssVariables {
  return cosmeticVisualDefinition(type, id).css;
}

export function missingCosmeticVisualIds(): string[] {
  return COSMETICS.filter((item) => !cosmeticVisualMap[item.id]).map(
    (item) => item.id,
  );
}

function cssText(css: CosmeticCssVariables): string {
  return Object.entries(css)
    .map(([property, value]) => `${property}:${value}`)
    .join(";");
}

function previewBody(item: Cosmetic, visual: CosmeticVisualDefinition) {
  if (item.type === "theme")
    return `<span class="preview-theme-shell"><span class="preview-theme-bar"></span><span class="preview-theme-card"><b></b><i></i><i></i></span><span class="preview-theme-motif motif-${visual.motif}"></span><span class="preview-theme-dots"><i></i><i></i><i></i></span></span>`;
  if (item.type === "cardStyle")
    return `<span class="preview-card-surface"><span class="preview-card-band"></span><strong></strong><i></i><i></i><em></em></span>`;
  if (item.type === "progressFrame")
    return `<span class="preview-passport-frame"><span class="preview-passport-mark">MS</span><b>12</b><small>XP</small><i></i></span>`;
  return `<span class="preview-title-badge"><i></i><strong>${htmlEscape(item.name)}</strong><small>${rarityLabel[item.rarity]}</small></span>`;
}

export function cosmeticPreviewMarkup(
  item: Cosmetic,
  options: { compact?: boolean; locked?: boolean; equipped?: boolean } = {},
): string {
  const visual = cosmeticVisualDefinition(item.type, item.id);
  const classes = [
    "cosmetic-preview",
    `cosmetic-preview-${item.type}`,
    `rarity-${item.rarity}`,
    `motif-${visual.motif}`,
    item.seasonExclusive ? "seasonal" : "",
    options.compact ? "compact" : "",
    options.locked ? "locked" : "",
    options.equipped ? "equipped" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<span class="${classes}" data-cosmetic-preview-id="${htmlEscape(item.id)}" data-cosmetic-type="${item.type}" style="${cssText(visual.css)}" aria-hidden="true">${previewBody(item, visual)}${
    options.locked ? '<span class="preview-lock"></span>' : ""
  }</span>`;
}

export function cosmeticPreviewLabel(item: Cosmetic): string {
  return `${typeLabel[item.type]}: ${item.name}`;
}
