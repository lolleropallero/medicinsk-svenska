import { mappedAsset, nordicAssets } from "./nordic-assets";
import { visualFixAssets } from "./visual-fix-assets";

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
    '<path d="M13 2c1 4-2 5-2 8 0 2 1 3 3 3 3 0 4-3 3-6 3 3 4 6 3 10-1.2 3.3-4.2 5-8 5-5 0-9-3.5-9-8.5 0-3.4 1.8-6.6 5-9-.3 3 1.2 4.5 3 5.5 0-4 1-6.5 4-8.5Z"/>',
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
    label: "Vanlig låda",
    className: "standard",
    asset: visualFixAssets.rewards.standard,
  },
  golden: {
    label: "Gyllene låda",
    className: "golden",
    asset: visualFixAssets.rewards.golden,
  },
  legendary: {
    label: "Legendarisk låda",
    className: "legendary",
    asset: visualFixAssets.rewards.legendary,
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

const COSMETIC_DEFAULTS = {
  theme: "theme-default",
  cardStyle: "cardStyle-default",
  progressFrame: "progressFrame-default",
  title: "title-default",
} as const;
export type VisualCosmeticType = keyof typeof COSMETIC_DEFAULTS;
export function cosmeticVisualToken(
  type: VisualCosmeticType,
  id: string,
): string {
  const seasonal: Partial<Record<VisualCosmeticType, string>> = {
    theme: "season-legendary",
    cardStyle: "season-epic-2",
    progressFrame: "season-epic-1",
    title: "season-rare",
  };
  if (id === COSMETIC_DEFAULTS[type] || id === seasonal[type]) return id;
  const pattern = new RegExp(`^${type}-(?:[1-9])$`);
  return pattern.test(id) ? id : COSMETIC_DEFAULTS[type];
}
