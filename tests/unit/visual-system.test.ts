import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENT_BADGES,
  ICON_PATHS,
  LEAGUE_BADGES,
  MOBILE_NAV_ITEMS,
  RARITY_VARIANTS,
  REWARD_BOX_VARIANTS,
  achievementBadge,
  cosmeticVisualToken,
  languageRibbon,
  leagueBadge,
  rarityVariant,
  resolveIcon,
  rewardBoxVariant,
} from "../../src/lib/visuals";

describe("Nordic Clinical Arcade visual catalog", () => {
  it("contains every required icon family and uses a safe fallback", () => {
    const required = [
      "home",
      "flashcards",
      "phrases",
      "descriptions",
      "progress",
      "calendar",
      "clock",
      "streak",
      "level",
      "credits",
      "shop",
      "collection",
      "season",
      "lock",
      "check",
      "shuffle",
      "retry",
      "gift",
      "theme",
      "cardStyle",
      "title",
      "progressFrame",
      "heartLungs",
    ];
    for (const name of required) expect(ICON_PATHS).toHaveProperty(name);
    expect(resolveIcon("missing-icon")).toBe("spark");
  });

  it("maps every achievement to its supplied badge without a generic fallback", () => {
    expect(Object.keys(ACHIEVEMENT_BADGES)).toEqual([
      "first-item",
      "items-10",
      "items-100",
      "items-500",
      "days-3",
      "days-10",
      "streak-3",
      "streak-7",
      "xp-100",
      "xp-1000",
      "modes-3",
      "active-60",
    ]);
    expect(achievementBadge("items-100")).toContain("items-100.svg");
    expect(achievementBadge("invalid")).toBeUndefined();
  });

  it("maps all league shields, reward boxes, and rarity frames with fallbacks", () => {
    expect(Object.values(LEAGUE_BADGES).map((item) => item.label)).toEqual([
      "Brons",
      "Silver",
      "Guld",
      "Platina",
      "Diamant",
      "Mästare",
    ]);
    expect(leagueBadge("Timantti").className).toBe("diamond");
    expect(Object.keys(REWARD_BOX_VARIANTS)).toEqual([
      "standard",
      "golden",
      "legendary",
    ]);
    expect(rewardBoxVariant("invalid")).toBe(REWARD_BOX_VARIANTS.standard);
    expect(Object.keys(RARITY_VARIANTS)).toEqual([
      "common",
      "rare",
      "epic",
      "legendary",
    ]);
    expect(rarityVariant("invalid")).toBe(RARITY_VARIANTS.common);
  });

  it("maps source and target language ribbons in both flashcard directions", () => {
    expect(languageRibbon("fi-sv", "source")).toMatchObject({
      language: "fi",
      className: "language-fi",
    });
    expect(languageRibbon("fi-sv", "target")).toMatchObject({
      language: "sv",
      className: "language-sv",
    });
    expect(languageRibbon("sv-fi", "source")).toMatchObject({
      language: "sv",
      className: "language-sv",
    });
    expect(languageRibbon("sv-fi", "target")).toMatchObject({
      language: "fi",
      className: "language-fi",
    });
  });

  it("validates theme, card-style, frame, and title tokens without trusting stored IDs", () => {
    expect(cosmeticVisualToken("theme", "theme-4")).toBe("theme-4");
    expect(cosmeticVisualToken("cardStyle", "season-epic-2")).toBe(
      "season-epic-2",
    );
    expect(cosmeticVisualToken("progressFrame", "bad")).toBe(
      "progressFrame-default",
    );
    expect(cosmeticVisualToken("title", "title-99")).toBe("title-default");
  });

  it("defines the five stable mobile navigation routes", () => {
    expect(MOBILE_NAV_ITEMS.map((item) => item.href)).toEqual([
      "/",
      "/kortit/",
      "/fraasit/",
      "/kuvailu/",
      "/edistyminen/",
    ]);
    expect(new Set(MOBILE_NAV_ITEMS.map((item) => item.icon)).size).toBe(5);
  });

  it("contains explicit calm-mode and reduced-motion overrides", () => {
    const css = readFileSync(
      new URL("../../src/styles/nordic-assets.css", import.meta.url),
      "utf8",
    );
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(':root[data-calm="true"]');
  });
});
