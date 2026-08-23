import { COSMETICS, EARNABLE_COSMETICS } from "../lib/progress/catalog";
import {
  localDayKey,
  msUntilLocalMidnight,
  seasonInfo,
} from "../lib/progress/calendar";
import {
  buyShopOffer,
  claimableSeasonCount,
  claimSeason,
  dailyShop,
  emptyDay,
  getQuestProgress,
  levelProgress,
  openCapsule,
  rerollQuest,
  SEASON_REWARDS,
  setDailyGoal,
} from "../lib/progress/core";
import {
  achievementCopy,
  boxCopy,
  leagueCopy,
  leagueResultCopy,
  plural,
  questCopy,
  rarityCopy,
  rewardCopy,
  weeklyQuestCopy,
} from "../lib/progress/copy";
import {
  canRerollQuest,
  compactCollection,
  compactSeasonTiers,
  leagueProgress,
  weeklyQuestProgress,
} from "../lib/progress/ui-derivations";
import {
  resolveDailyQuestAction,
  type ResumableSession,
} from "../lib/progress/daily-quest-action";
import {
  exportEnvelope,
  loadProgress,
  parseImport,
  PROGRESS_KEY,
  resetProgress,
  saveProgress,
} from "../lib/progress/storage";
import {
  dismissDailyOverlay,
  loadUiPreferences,
  markDailyOverlayHandled,
  shouldAutoOpenDailyOverlay,
} from "../lib/progress/ui-preferences";
import type {
  CosmeticType,
  ExerciseMode,
  ProgressStateV1,
  Quest,
  Reward,
} from "../lib/progress/types";
import { buildSessionUrl } from "../lib/session-url";
import {
  isSessionComplete,
  isStoredSession,
  type CreateSessionOptions,
  type FlashcardSession,
} from "../lib/session";
import { buildPhraseSessionUrl } from "../lib/phrase-url";
import {
  isPhraseSessionComplete,
  isStoredPhraseSession,
  type PhraseSession,
  type PhraseSessionConfiguration,
} from "../lib/phrase-session";
import { buildDescriptionSessionUrl } from "../lib/description-url";
import {
  isStoredDescriptionSession,
  type DescriptionSession,
  type DescriptionSessionConfiguration,
} from "../lib/description-session";
import {
  achievementBadge,
  iconSvg,
  leagueBadge,
  rarityVariant,
  rewardBoxVariant,
} from "../lib/visuals";
import {
  normalizeRewardBoxKind,
  rewardBoxImage,
  type RewardBoxSize,
} from "../lib/reward-box-assets";
import { nordicAssets } from "../lib/nordic-assets";
import { playSound } from "../lib/sound/player";
import { loadSoundSettings, saveSoundSettings } from "../lib/sound/settings";

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T | null;
const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const formatMinutes = (ms: number) => `${Math.floor(ms / 60_000)} min`;
const typeCopy: Record<CosmeticType, string> = {
  theme: "Tema",
  cardStyle: "Kortstil",
  progressFrame: "Framstegsram",
  title: "Titel",
};
const questIcon = (quest: Quest) =>
  quest.kind === "mode"
    ? quest.mode === "flashcards"
      ? "flashcards"
      : quest.mode === "phrases"
        ? "phrases"
        : "descriptions"
    : quest.kind === "active"
      ? "clock"
      : quest.kind === "retries"
        ? "retry"
        : quest.kind === "variety"
          ? "spark"
          : quest.kind === "sessions"
            ? "calendar"
            : "level";
const decorativeImage = (
  src: string,
  width: number,
  height: number,
  className = "",
  lazy = false,
) =>
  `<img${className ? ` class="${className}"` : ""} src="${src}" width="${width}" height="${height}" alt="" aria-hidden="true"${lazy ? ' loading="lazy"' : ""} decoding="async">`;
const compactRewardBoxVisual = (kind: string, label?: string) => {
  const variant = rewardBoxVariant(kind);
  const asset = rewardBoxImage(normalizeRewardBoxKind(kind), "small");
  return `<span class="compact-reward-box reward-box-visual box-${variant.className} box-small"${label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"'}>${decorativeImage(asset.src, asset.width, asset.height, "compact-box-image")}</span>`;
};
const rewardBoxVisual = (kind: string, size: RewardBoxSize = "normal") => {
  const variant = rewardBoxVariant(kind);
  const asset = rewardBoxImage(normalizeRewardBoxKind(kind), size);
  return size === "small"
    ? compactRewardBoxVisual(kind, variant.label)
    : `<span class="reward-box-visual box-${variant.className} box-${size}" role="img" aria-label="${variant.label}">${decorativeImage(asset.src, asset.width, asset.height)}</span>`;
};
const achievementVisual = (id: string, _name: string, unlocked: boolean) => {
  const asset = achievementBadge(id);
  if (!asset) throw new Error(`Unknown achievement asset: ${id}`);
  return `<span class="achievement-badge badge-${id} ${unlocked ? "unlocked" : "locked"}" aria-hidden="true">${decorativeImage(asset, 220, 250, "", true)}</span>`;
};
const leagueVisual = (tier: string, large = false) => {
  const badge = leagueBadge(tier);
  return `<span class="league-badge league-${badge.className} ${large ? "large" : ""}" aria-hidden="true">${decorativeImage(badge.asset, 240, 280, "league-shield", true)}</span>`;
};
const rarityFrameVisual = (rarity: string) => {
  const frame = rarityVariant(rarity);
  return decorativeImage(
    frame.asset,
    220,
    260,
    `rarity-frame rarity-${frame.className}`,
    true,
  );
};
const seasonRewardVisual = (rewards: Reward[]) => {
  const capsule = rewards.find(
    (reward): reward is Extract<Reward, { type: "capsule" }> =>
      reward.type === "capsule",
  );
  if (capsule) return compactRewardBoxVisual(capsule.kind);
  const cosmetic = rewards.find(
      (reward): reward is Extract<Reward, { type: "cosmetic" }> =>
        reward.type === "cosmetic",
    ),
    item = cosmetic
      ? COSMETICS.find((value) => value.id === cosmetic.cosmeticId)
      : undefined;
  return item
    ? `<span class="checkpoint-cosmetic framed-media">${iconSvg(item.type === "theme" ? "theme" : item.type === "cardStyle" ? "cardStyle" : item.type === "progressFrame" ? "progressFrame" : "title", 24)}${rarityFrameVisual(item.rarity)}</span>`
    : "";
};
let state = loadProgress();
let collectionFilter = "owned";
let collectionShowAll = false;
let seasonMobilePanel: "rewards" | "league" = "rewards";
let seasonShowAll = false;
let autoOpenChecked = false;
const SESSION_KEYS: Record<ExerciseMode, string> = {
  flashcards: "medicinsk-svenska.flashcard-session.v1",
  phrases: "medicinsk-svenska.phrase-session.v1",
  descriptions: "medicinsk-svenska.description-session.v1",
};

interface DailySessionCatalog {
  cards: [string, string][];
  decks: string[];
  phrases: [string, string][];
  phraseCategories: string[];
  descriptions: [string, string][];
  descriptionCategories: string[];
}

function dailySessionCatalog(): DailySessionCatalog | null {
  const node = $<HTMLScriptElement>("daily-session-catalog");
  if (!node) return null;
  try {
    return JSON.parse(node.textContent ?? "null") as DailySessionCatalog;
  } catch {
    return null;
  }
}
function storedValue(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
function resumableSessions(): Partial<Record<ExerciseMode, ResumableSession>> {
  const catalog = dailySessionCatalog();
  if (!catalog) return {};
  const sessions: Partial<Record<ExerciseMode, ResumableSession>> = {};
  const flash = storedValue(SESSION_KEYS.flashcards);
  if (flash && typeof flash === "object") {
    const candidate = flash as FlashcardSession,
      expected: CreateSessionOptions = {
        sessionId: candidate.sessionId,
        mode: candidate.mode,
        direction: candidate.direction,
        requestedAmount: candidate.requestedAmount,
        ...(candidate.mode === "deck" && candidate.sourceDeckId
          ? { sourceDeckId: candidate.sourceDeckId }
          : {}),
      };
    if (
      isStoredSession(flash, {
        cardDeckById: new Map(catalog.cards),
        validDeckIds: new Set(catalog.decks),
        expected,
      }) &&
      !isSessionComplete(candidate)
    )
      sessions.flashcards = {
        href: buildSessionUrl(expected),
        startedAt: candidate.startedAt,
      };
  }
  const phrase = storedValue(SESSION_KEYS.phrases);
  if (phrase && typeof phrase === "object") {
    const candidate = phrase as PhraseSession,
      expected: PhraseSessionConfiguration = {
        sessionId: candidate.sessionId,
        mode: candidate.mode,
        requestedAmount: candidate.requestedAmount,
        ...(candidate.mode === "category" && candidate.sourceCategoryId
          ? { sourceCategoryId: candidate.sourceCategoryId }
          : {}),
      };
    if (
      isStoredPhraseSession(phrase, {
        categoryByPhraseId: new Map(catalog.phrases),
        validCategoryIds: new Set(catalog.phraseCategories),
        expected,
      }) &&
      !isPhraseSessionComplete(candidate)
    )
      sessions.phrases = {
        href: buildPhraseSessionUrl(expected),
        startedAt: candidate.startedAt,
      };
  }
  const description = storedValue(SESSION_KEYS.descriptions);
  if (description && typeof description === "object") {
    const candidate = description as DescriptionSession,
      expected: DescriptionSessionConfiguration = {
        sessionId: candidate.sessionId,
        sourceMode: candidate.sourceMode,
        requestedAmount: candidate.requestedAmount,
        roundType: candidate.roundType,
        ...(candidate.sourceMode === "category" && candidate.sourceCategoryId
          ? { sourceCategoryId: candidate.sourceCategoryId }
          : {}),
      };
    if (
      isStoredDescriptionSession(description, {
        categoryByExerciseId: new Map(catalog.descriptions),
        validCategoryIds: new Set(catalog.descriptionCategories),
        expected,
      }) &&
      candidate.currentIndex < candidate.selectedExerciseIds.length
    )
      sessions.descriptions = {
        href: buildDescriptionSessionUrl(expected),
        startedAt: candidate.startedAt,
      };
  }
  return sessions;
}
function freshSessionUrls(): Record<ExerciseMode, string> {
  return {
    flashcards: buildSessionUrl({
      sessionId: crypto.randomUUID(),
      mode: "lucky",
      direction: "fi-sv",
      requestedAmount: 10,
    }),
    phrases: buildPhraseSessionUrl({
      sessionId: crypto.randomUUID(),
      mode: "all",
      requestedAmount: 10,
    }),
    descriptions: buildDescriptionSessionUrl({
      sessionId: crypto.randomUUID(),
      sourceMode: "all",
      requestedAmount: 10,
      roundType: "initial",
    }),
  };
}
function persist(next: ProgressStateV1) {
  state = next;
  saveProgress(state);
  render();
  window.dispatchEvent(new CustomEvent("progress-updated"));
}
function progressBar(value: number, max: number, label: string) {
  const percent = Math.min(100, max ? (value / max) * 100 : 0);
  return `<div class="meter" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}"><span style="width:${percent}%"></span></div>`;
}
function today() {
  const key = localDayKey();
  return state.daily[key] ?? emptyDay(state, key);
}
function questValue(quest: Quest, value: number) {
  return quest.kind === "active"
    ? `${Math.floor(value / 60_000)} / 5 min`
    : `${value} / ${quest.target}`;
}
function questRows(day = today(), allowReroll = true) {
  return day.quests
    .map((quest) => {
      const copy = questCopy(quest),
        value = getQuestProgress(day, quest),
        canReroll =
          allowReroll &&
          canRerollQuest(quest, day, state.inventory.rerollTokens);
      return `<article class="quest mission-ticket ${quest.claimed ? "done" : ""}" data-quest-slot="${quest.slot}"><span class="quest-icon">${iconSvg(questIcon(quest), 24)}</span><div class="quest-content"><div class="quest-head"><div><strong lang="sv">${copy.sv}</strong><small lang="fi">${copy.fi}</small></div><span class="quest-progress" lang="sv">${quest.claimed ? `${iconSvg("check")} Klart` : questValue(quest, value)}</span></div>${progressBar(value, quest.target, `${copy.sv}: ${questValue(quest, value)}`)}<div class="quest-meta" lang="sv"><span class="reward-chips"><b>+${quest.xp} XP</b><b>+${quest.credits} krediter</b><b>+${quest.seasonPoints} SP</b></span>${canReroll ? `<button data-reroll="${quest.slot}" class="compact tertiary">${iconSvg("retry")} Byt uppdrag</button>` : ""}</div></div></article>`;
    })
    .join("");
}
function bindRerolls(root: HTMLElement) {
  root.querySelectorAll<HTMLButtonElement>("[data-reroll]").forEach((button) =>
    button.addEventListener("click", () => {
      const next = rerollQuest(state, Number(button.dataset.reroll));
      if (next) persist(next);
    }),
  );
}

function overlayQuestRows(day = today()) {
  return day.quests
    .map((quest) => {
      const copy = questCopy(quest),
        value = getQuestProgress(day, quest),
        valueCopy = questValue(quest, value),
        canReroll = canRerollQuest(quest, day, state.inventory.rerollTokens),
        body = `<span class="daily-quest-icon">${iconSvg(questIcon(quest), 32)}</span><span class="daily-quest-copy"><span class="daily-quest-head"><span><strong lang="sv">${copy.sv}</strong><small lang="fi">${copy.fi}</small></span><b lang="sv">${quest.claimed ? "Klart" : valueCopy}</b></span>${progressBar(value, quest.target, `${copy.sv}: ${valueCopy}`)}<span class="daily-quest-reward reward-chips" lang="sv"><b>+${quest.xp} XP</b><b>+${quest.credits} krediter</b><b>+${quest.seasonPoints} SP</b></span></span>`;
      return `<article class="daily-quest-row mission-ticket ${quest.claimed ? "done" : ""}" data-quest-slot="${quest.slot}">${quest.claimed ? `<div class="daily-quest-complete">${body}</div>` : `<button type="button" class="daily-quest-action" data-quest-action="${quest.slot}" data-focus-id="quest-${quest.slot}">${body}<span class="daily-quest-start" lang="sv">Starta ${iconSvg("arrow")}</span></button>`}${canReroll ? `<button type="button" data-reroll="${quest.slot}" data-focus-id="reroll-${quest.slot}" class="compact tertiary daily-reroll" lang="sv">${iconSvg("retry")} Byt uppdrag</button>` : ""}</article>`;
    })
    .join("");
}
function bindHomeActions(root: HTMLElement, day = today()) {
  bindRerolls(root);
  root
    .querySelectorAll<HTMLButtonElement>("[data-quest-action]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        const quest = day.quests.find(
          (item) => item.slot === Number(button.dataset.questAction),
        );
        if (!quest) return;
        const action = resolveDailyQuestAction(quest, {
          ...(state.lastUsedMode ? { lastUsedMode: state.lastUsedMode } : {}),
          modesUsedToday: day.modes,
          sessions: resumableSessions(),
          freshUrls: freshSessionUrls(),
        });
        if (!action) return;
        try {
          markDailyOverlayHandled();
        } catch {}
        if (!action.resumesSession)
          localStorage.removeItem(SESSION_KEYS[action.mode]);
        location.assign(action.href);
      }),
    );
}
function openDailyOverlay() {
  const dialog = $<HTMLDialogElement>("daily-overlay");
  if (!dialog || dialog.open || document.querySelector("dialog[open]")) return;
  dialog.showModal();
  playSound('overlay-open');
  const target =
    dialog.querySelector<HTMLElement>("[data-quest-action]") ??
    $("daily-overlay-title");
  target?.focus({ preventScroll: true });
}
function closeDailyOverlay(options: {
  markDismissed: boolean;
  restoreFocus: boolean;
}) {
  const dialog = $<HTMLDialogElement>("daily-overlay");
  if (!dialog?.open) return;
  if (options.markDismissed) dismissDailyOverlay();
  dialog.close();
  playSound('overlay-close');
  if (options.restoreFocus)
    $<HTMLButtonElement>("daily-launcher")?.focus({ preventScroll: true });
}
function renderHome() {
  const launcher = $<HTMLButtonElement>("daily-launcher"),
    root = $("daily-overlay-content");
  if (!launcher || !root) return;
  const day = today(),
    goalComplete = day.uniqueItemIds.length >= state.settings.dailyGoal,
    questCount = day.quests.filter((quest) => quest.claimed).length,
    allComplete = questCount === day.quests.length,
    activeFocus = (document.activeElement as HTMLElement | null)?.dataset
      .focusId;
  $("daily-launcher-quests")!.textContent =
    `Dagens uppdrag ${questCount} / ${day.quests.length}`;
  $("daily-launcher-goal")!.textContent = goalComplete
    ? "Dagens mål klart"
    : `Dagens mål ${day.uniqueItemIds.length} / ${state.settings.dailyGoal}`;
  root.innerHTML = `<section class="overlay-goal"><span class="goal-box">${rewardBoxVisual("standard")}</span><div class="goal-copy"><div><h3 lang="sv">Dagens mål</h3><strong lang="sv">${goalComplete ? `${iconSvg("check")} Klart` : `${day.uniqueItemIds.length} / ${state.settings.dailyGoal}`}</strong></div>${progressBar(day.uniqueItemIds.length, state.settings.dailyGoal, "Dagens mål")}<small lang="sv">Vanlig belöning · 10 krediter · 20 säsongspoäng</small></div></section><div class="daily-overlay-quests">${overlayQuestRows(day)}</div><footer class="daily-all-bonus"><span class="daily-all-bonus-box">${rewardBoxVisual("golden")}</span><span class="daily-all-bonus-copy"><strong lang="sv">${allComplete ? "Alla tre uppdrag klara" : "Slutför alla tre och få en gyllene belöning"}</strong><small lang="fi">Suorita kaikki kolme ja saat kultaisen palkinnon.</small></span></footer>`;
  bindHomeActions(root, day);
  if (activeFocus && $("daily-overlay")?.hasAttribute("open"))
    (
      root.querySelector<HTMLElement>(`[data-focus-id="${activeFocus}"]`) ??
      root.querySelector<HTMLElement>("[data-quest-action]") ??
      $<HTMLButtonElement>("daily-overlay-close")
    )?.focus({ preventScroll: true });
}

function renderProgress() {
  const root = $("progress-dashboard");
  if (!root) return;
  const day = today(),
    level = levelProgress(state.lifetime.xp),
    lastDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const key = localDayKey(date);
      return { key, value: state.daily[key] ?? emptyDay(state, key) };
    }),
    claimable = claimableSeasonCount(state),
    weekly = weeklyQuestProgress(state);
  root.innerHTML = `<section class="passport-card full-width" lang="sv">${decorativeImage(nordicAssets.brand.crossFi, 128, 128, "passport-cross fi")}${decorativeImage(nordicAssets.brand.crossSv, 128, 128, "passport-cross sv")}<div class="passport-brand">${iconSvg("progressFrame", 32)}<span><small>MEDICINSK SVENSKA</small><strong>Nordiskt studiepass</strong></span></div><div class="passport-level"><span class="xp-ring" style="--xp:${Math.max(4, Math.round(((state.lifetime.xp - level.currentThreshold) / (level.nextThreshold - level.currentThreshold)) * 100))}%"><b>${level.level}</b></span><span><small>Nivå</small><strong>${state.lifetime.xp} XP</strong></span></div><div class="passport-status"><span>${iconSvg("streak")}<b>${state.streak.current}</b><small>dagars svit</small></span><span>${iconSvg("title")}<b>${esc(COSMETICS.find((item) => item.id === state.inventory.equipped.title)?.name ?? "Student")}</b><small>titel</small></span><span>${iconSvg("progressFrame")}<b>${esc(COSMETICS.find((item) => item.id === state.inventory.equipped.progressFrame)?.name ?? "Basram")}</b><small>ram</small></span></div>${progressBar(state.lifetime.xp - level.currentThreshold, level.nextThreshold - level.currentThreshold, "Framsteg till nästa nivå")}</section>
  <section class="dashboard-card today-card" lang="sv"><div class="section-title"><h2>${iconSvg("calendar")} I dag</h2><strong>${day.uniqueItemIds.length} / ${state.settings.dailyGoal}</strong></div>${progressBar(day.uniqueItemIds.length, state.settings.dailyGoal, "Dagens mål")}<div class="stat-grid visual-metrics"><span>${iconSvg("check")}<strong>${day.completedItems}</strong>Uppgifter</span><span>${iconSvg("clock")}<strong>${formatMinutes(day.activeStudyMs)}</strong>Aktiv tid</span><span>${iconSvg("level")}<strong>${day.xp}</strong>XP</span><span>${iconSvg("spark")}<strong>${day.modes.length}</strong>Övningstyper</span></div>${claimable ? `<a class="reward-alert" href="/kausi/#reward-track">${iconSvg("gift")} ${claimable} säsongsbelöning väntar</a>` : ""}</section>
  <section class="dashboard-card daily-missions"><h2 lang="sv">${iconSvg("level")} Dagens uppdrag</h2><div class="quest-list">${questRows(day)}</div><div class="all-quests-bonus">${rewardBoxVisual("golden")}<span><strong lang="sv">Slutför alla tre och få en gyllene belöning</strong><small lang="fi">Suorita kaikki kolme ja saat kultaisen palkinnon.</small></span></div></section>
  <section class="dashboard-card weekly-card" lang="sv"><h2>${iconSvg("streak")} Svit och vecka</h2><div class="stat-grid"><span><strong>${state.streak.current}</strong>Nuvarande svit</span><span><strong>${state.streak.longest}</strong>Längsta svit</span><span><strong>${state.inventory.streakFreezes} / 2</strong>Svitfrysningar</span><span><strong>${Object.values(state.daily).filter((value) => value.uniqueItemIds.length).length}</strong>Studiedagar</span></div><h3>Veckans uppdrag</h3><div class="weekly-quest-list">${weekly
    .map((quest, index) => {
      const copy = weeklyQuestCopy[index]!;
      return `<article class="weekly-quest mission-ticket ${quest.complete ? "done" : ""}"><span class="quest-icon">${iconSvg(["flashcards", "phrases", "descriptions"][index] ?? "level")}</span><div><div class="weekly-quest-head"><span><strong lang="sv">${copy.sv}</strong><small lang="fi">${copy.fi}</small></span><b>${quest.complete ? "Klart" : `${quest.value} / ${quest.target}`}</b></div>${progressBar(quest.value, quest.target, `${copy.sv}: ${quest.value} av ${quest.target}`)}<span class="weekly-rewards">+${quest.xp} XP · +${quest.credits} krediter · +${quest.seasonPoints} säsongspoäng</span></div></article>`;
    })
    .join("")}</div></section>
  <section class="dashboard-card chart-card" lang="sv"><h2>${iconSvg("progress")} De senaste sju dagarna</h2><div class="bar-chart" aria-hidden="true">${lastDays.map(({ key, value }, index) => `<div class="${index === 6 ? "today" : ""}"><span style="height:${Math.max(3, Math.min(100, value.uniqueItemIds.length * 4))}%"></span><small>${key.slice(5)}</small></div>`).join("")}</div><table class="sr-table"><caption>Uppgifter under de senaste sju dagarna</caption><thead><tr><th>Dag</th><th>Uppgifter</th><th>Minuter</th><th>XP</th></tr></thead><tbody>${lastDays.map(({ key, value }) => `<tr><th>${key}</th><td>${value.uniqueItemIds.length}</td><td>${Math.floor(value.activeStudyMs / 60000)}</td><td>${value.xp}</td></tr>`).join("")}</tbody></table></section>
  <section class="dashboard-card lifetime-card" lang="sv"><h2>${iconSvg("level")} Totalt</h2><p class="level-line">Nivå <strong>${level.level}</strong> · ${state.lifetime.xp} / ${level.nextThreshold} <abbr title="erfarenhetspoäng">XP</abbr></p><p class="muted">Nivån visar hur mycket du har övat, inte din språknivå.</p><div class="stat-grid"><span><strong>${state.lifetime.completedItems}</strong>Uppgifter</span><span><strong>${formatMinutes(state.lifetime.activeStudyMs)}</strong>Aktiv tid</span><span><strong>${state.lifetime.sessionsCompleted}</strong>Övningspass</span><span><strong>${state.lifetime.studyDays}</strong>Studiedagar</span><span><strong>${state.lifetime.retriesMastered}</strong>Bemästrade repetitioner</span></div></section>
  <section class="dashboard-card achievements-card full-width" lang="sv"><div class="section-title"><h2>${iconSvg("level")} Prestationer</h2><small>${state.achievements.filter((item) => item.unlockedAt).length} / ${state.achievements.length} upplåsta</small></div><div class="achievement-grid">${state.achievements
    .map((item) => {
      const copy = achievementCopy(item),
        unlocked = Boolean(item.unlockedAt);
      return `<article class="achievement ${unlocked ? "unlocked" : "locked"}" data-achievement-id="${item.id}">${achievementVisual(item.id, copy.name, unlocked)}<span><strong>${copy.name}</strong><small>${copy.description}</small><b>${unlocked ? "Upplåst" : "Låst"}</b></span></article>`;
    })
    .join("")}</div></section>
  <section class="dashboard-card records-card" lang="sv"><h2>${iconSvg("progress")} Personliga rekord</h2><dl class="record-list"><div><dt>Flest uppgifter på en dag</dt><dd>${state.records.mostItemsDay}</dd></div><div><dt>Mest aktiv tid på en dag</dt><dd>${formatMinutes(state.records.mostActiveMsDay)}</dd></div><div><dt>Mest XP på en dag</dt><dd>${state.records.mostXpDay}</dd></div><div><dt>Bästa sju dagar</dt><dd>${state.records.bestSevenDayItems}</dd></div></dl></section>`;
  bindRerolls(root);
}
function renderSettings() {
  const goal = $<HTMLSelectElement>("daily-goal");
  if (!goal) return;
  goal.value = String(state.settings.dailyGoal);
  const calm = $<HTMLInputElement>("calm-mode");
  if (calm) calm.checked = state.settings.calmMode;
  const sound=loadSoundSettings(),enabled=$<HTMLInputElement>('sound-enabled'),volume=$<HTMLInputElement>('sound-volume'),output=$<HTMLOutputElement>('sound-volume-value');
  if(enabled)enabled.checked=sound.enabled;
  if(volume)volume.value=String(Math.round(sound.volume*100));
  if(output)output.value=`${Math.round(sound.volume*100)} %`;
}
function shopLabel(type: string, itemId: string) {
  if (type === "cosmetic")
    return COSMETICS.find((item) => item.id === itemId)?.name ?? "Kosmetik";
  if (type === "utility")
    return itemId === "streakFreeze" ? "Svitfrysning" : "Uppdragsbyte";
  return boxCopy[itemId as keyof typeof boxCopy];
}
function renderRewards() {
  const root = $("rewards-dashboard");
  if (!root) return;
  const unopened = state.inventory.capsules.filter((item) => !item.openedAt),
    collection = compactCollection(
      COSMETICS,
      state.inventory.ownedCosmeticIds,
      collectionShowAll,
      collectionFilter,
    ),
    ownedBase = state.inventory.ownedCosmeticIds.filter((id) =>
      EARNABLE_COSMETICS.some((item) => item.id === id),
    ).length,
    seasonal = COSMETICS.filter((item) => item.seasonExclusive),
    ownedSeasonal = seasonal.filter((item) =>
      state.inventory.ownedCosmeticIds.includes(item.id),
    ).length;
  root.innerHTML = `<section class="dashboard-card inventory-head full-width" lang="sv"><div>${iconSvg("credits")}<span>Krediter</span><strong>${state.inventory.credits}</strong></div><div>${iconSvg("streak")}<span>Svitfrysningar</span><strong>${state.inventory.streakFreezes} / 2</strong></div><div>${iconSvg("retry")}<span>Uppdragsbyten</span><strong>${state.inventory.rerollTokens}</strong></div></section>
  <section id="unopened-boxes" class="dashboard-card full-width box-vault" lang="sv"><div class="section-title"><div><span class="eyebrow">Belöningsvalv</span><h2>${compactRewardBoxVisual("standard")} Belöningar</h2></div><span>${unopened.length} oöppnade</span></div>${unopened.length ? `<div class="capsule-list">${unopened.map((item) => `<button class="capsule box-${item.kind}" data-open="${item.id}" aria-label="${boxCopy[item.kind]} Öppna">${rewardBoxVisual(item.kind, "large")}<span><strong>${boxCopy[item.kind]}</strong><small>Raritet visas alltid efter öppning</small><b>Öppna ${iconSvg("arrow")}</b></span></button>`).join("")}</div>` : '<div class="empty-vault">' + rewardBoxVisual("standard") + "<p>Inga oöppnade belöningar.</p></div>"}<details><summary>Chanser och garanti</summary><p>Vanlig 65 % · Sällsynt 25 % · Episk 8 % · Legendarisk 2 %</p><p>Sällsynt eller bättre senast om ${plural(4 - state.loot.sinceRare, "belöning", "belöningar")}<br>Episk eller bättre senast om ${plural(12 - state.loot.sinceEpic, "belöning", "belöningar")}<br>Legendarisk senast om ${plural(40 - state.loot.sinceLegendary, "belöning", "belöningar")}</p></details></section>
  <section id="daily-shop" class="dashboard-card full-width shop-card" lang="sv"><header class="shop-head"><span>${iconSvg("shop", 32)}</span><div><span class="eyebrow">Uppdateras dagligen</span><h2>Dagens butik</h2></div><strong>${iconSvg("credits")} ${state.inventory.credits}</strong></header><div class="shop-grid">${dailyShop(
    state,
  )
    .map((offer, index) => {
      const rarity = ["common", "rare", "epic", "legendary"][index % 4]!;
      return `<article class="offer rarity-${rarity}"><span class="offer-icon ${offer.type === "capsule" ? "reward-offer-media" : "framed-media"}">${offer.type === "capsule" ? rewardBoxVisual(offer.itemId) : `${iconSvg(offer.type === "cosmetic" ? "theme" : "retry", 32)}${rarityFrameVisual(rarity)}`}</span>${offer.discounted ? '<b class="discount-corner">Erbjudande</b>' : ""}<strong>${shopLabel(offer.type, offer.itemId)}</strong><span>${offer.discounted ? `<s>${offer.originalPrice}</s> ` : ""}${offer.price} krediter</span><button data-buy="${offer.id}" ${offer.purchased || state.inventory.credits < offer.price ? "disabled" : ""}>${offer.purchased ? "Redan hämtad" : `Lös in för ${offer.price} krediter`}</button></article>`;
    })
    .join(
      "",
    )}</div>${state.settings.calmMode ? "" : `<p class="muted">Nya erbjudanden om ${new Date(msUntilLocalMidnight()).toISOString().slice(11, 19)}</p>`}</section>
  <section id="appearance" class="dashboard-card appearance-card" lang="sv"><h2>${iconSvg("theme")} Utseende</h2><div class="appearance-preview"><span class="passport-mini">${decorativeImage(nordicAssets.brand.crossFi, 128, 128, "mini-cross")}${iconSvg("progressFrame", 32)}<strong>${esc(COSMETICS.find((item) => item.id === state.inventory.equipped.title)?.name ?? "Student")}</strong><small>Medicinsk svenska</small></span></div><div class="equipment">${(
    ["theme", "cardStyle", "progressFrame", "title"] as CosmeticType[]
  )
    .map(
      (type) =>
        `<label>${iconSvg(type === "theme" ? "theme" : type === "cardStyle" ? "cardStyle" : type === "progressFrame" ? "progressFrame" : "title")} ${typeCopy[type]}<select data-equip="${type}">${COSMETICS.filter(
          (item) =>
            item.type === type &&
            state.inventory.ownedCosmeticIds.includes(item.id),
        )
          .map(
            (item) =>
              `<option value="${item.id}" ${state.inventory.equipped[type] === item.id ? "selected" : ""}>${item.name}</option>`,
          )
          .join("")}</select></label>`,
    )
    .join("")}</div></section>
  <section id="collection" class="dashboard-card collection-card" lang="sv"><div class="section-title"><div><span class="eyebrow">Nordiskt samlingspass</span><h2>${iconSvg("collection")} Samling</h2></div></div><div class="collection-counts"><span>Bassamling <strong>${ownedBase} / ${EARNABLE_COSMETICS.length}</strong></span><span>Säsong <strong>${ownedSeasonal} / ${seasonal.length}</strong></span></div><div class="collection-controls"><label class="filter-label">Visa i samlingen<select id="collection-filter"><option value="owned" ${collectionFilter === "owned" ? "selected" : ""}>Ägda</option><option value="all" ${collectionFilter === "all" ? "selected" : ""}>Alla</option><option value="theme" ${collectionFilter === "theme" ? "selected" : ""}>Teman</option><option value="cardStyle" ${collectionFilter === "cardStyle" ? "selected" : ""}>Kortstilar</option><option value="progressFrame" ${collectionFilter === "progressFrame" ? "selected" : ""}>Framstegsramar</option><option value="title" ${collectionFilter === "title" ? "selected" : ""}>Titlar</option></select></label>${collectionShowAll ? "" : `<button type="button" class="compact" data-show-all-collection>Visa alla</button>`}</div><div class="collection-grid">${collection
    .map((item) => {
      const owned = state.inventory.ownedCosmeticIds.includes(item.id);
      return `<article class="collectible rarity-${item.rarity} ${owned ? "owned" : "locked"}" data-cosmetic-id="${item.id}"><div class="cosmetic-swatch framed-media">${iconSvg(item.type === "theme" ? "theme" : item.type === "cardStyle" ? "cardStyle" : item.type === "progressFrame" ? "progressFrame" : "title", 32)}${owned ? "" : iconSvg("lock")}${rarityFrameVisual(item.rarity)}</div><strong>${item.name}</strong><span class="rarity-label">${rarityCopy[item.rarity]}${item.seasonExclusive ? " · Säsong" : ""}</span><small>${owned ? item.description : "Låst"}</small>${owned && state.inventory.equipped[item.type] !== item.id ? `<button data-use="${item.id}" class="compact">Använd</button>` : owned ? "<b>Utrustad</b>" : ""}</article>`;
    })
    .join("")}</div></section>`;
  root.querySelectorAll<HTMLButtonElement>("[data-open]").forEach((button) =>
    button.addEventListener("click", () => {
      const result = openCapsule(state, button.dataset.open!);
      if (result) {
        persist(result.state);
        showCapsule(result.capsule);
      }
    }),
  );
  root.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((button) =>
    button.addEventListener("click", () => {
      const next = buyShopOffer(state, button.dataset.buy!);
      if (next) persist(next);
    }),
  );
  root.querySelectorAll<HTMLButtonElement>("[data-use]").forEach((button) =>
    button.addEventListener("click", () => {
      const item = COSMETICS.find((value) => value.id === button.dataset.use);
      if (item) {
        const next = structuredClone(state);
        next.inventory.equipped[item.type] = item.id;
        persist(next);
      }
    }),
  );
  root.querySelectorAll<HTMLSelectElement>("[data-equip]").forEach((select) =>
    select.addEventListener("change", () => {
      const type = select.dataset.equip as CosmeticType,
        item = COSMETICS.find(
          (value) => value.id === select.value && value.type === type,
        );
      if (item && state.inventory.ownedCosmeticIds.includes(item.id)) {
        const next = structuredClone(state);
        next.inventory.equipped[type] = item.id;
        persist(next);
      }
    }),
  );
  $<HTMLSelectElement>("collection-filter")?.addEventListener(
    "change",
    (event) => {
      collectionFilter = (event.target as HTMLSelectElement).value;
      collectionShowAll = collectionFilter === "all";
      renderRewards();
    },
  );
  root
    .querySelector<HTMLButtonElement>("[data-show-all-collection]")
    ?.addEventListener("click", () => {
      collectionFilter = "all";
      collectionShowAll = true;
      renderRewards();
    });
}
function showCapsule(capsule: {
  kind: string;
  rarity?: string;
  reward?: Reward;
}) {
  const dialog = $<HTMLDialogElement>("capsule-dialog");
  if (!dialog || !capsule.reward) return;
  const rarity = capsule.rarity ?? "common";
  dialog.dataset.rarity = rarity;
  const stage = dialog.querySelector<HTMLElement>(".capsule-stage");
  if (stage)
    stage.innerHTML = `<span class="capsule-box">${rewardBoxVisual(capsule.kind, "large")}</span><span class="capsule-reward-frame framed-media">${iconSvg(capsule.reward.type === "cosmetic" ? "theme" : capsule.reward.type === "credits" ? "credits" : "gift", 32)}${rarityFrameVisual(rarity)}</span>`;
  $("capsule-rarity")!.textContent =
    rarityCopy[rarity as keyof typeof rarityCopy];
  $("capsule-reward")!.textContent = rewardCopy(capsule.reward);
  dialog.showModal();
  playSound('reward-reveal');
  dialog.querySelector<HTMLButtonElement>("[data-close]")?.focus();
}
function renderSeason() {
  const root = $("season-dashboard");
  if (!root) return;
  const info = seasonInfo(),
    step = Math.min(30, Math.floor(state.seasons.points / 100)),
    remainder = state.seasons.points % 100,
    claimable = claimableSeasonCount(state),
    league = leagueProgress(state.league.tier, state.league.weeklyXp),
    mobile = matchMedia("(max-width:560px)").matches,
    selected = location.hash === "#league" ? "league" : seasonMobilePanel,
    tiers = seasonShowAll
      ? Array.from({ length: 30 }, (_, index) => index + 1)
      : compactSeasonTiers(state.seasons.points, state.seasons.claimedTiers),
    currentLeague = leagueCopy[state.league.tier],
    nextLeague = league.nextTier ? leagueCopy[league.nextTier] : undefined,
    targetCopy =
      league.phase === "retention"
        ? `Behåll ${currentLeague}`
        : league.phase === "promotion"
          ? `Till ${nextLeague}`
          : league.phase === "promotion-secured"
            ? `Befordran till ${nextLeague} säkrad`
            : `${currentLeague} säkrad`,
    barValue = Math.min(state.league.weeklyXp, league.target),
    barLabel = `${targetCopy}: ${barValue} av ${league.target} XP`;
  const tierRows = tiers
    .map((tier) => {
      const rewards = SEASON_REWARDS[tier]!,
        unlocked = state.seasons.points >= tier * 100,
        claimed = state.seasons.claimedTiers.includes(tier),
        current = tier === Math.min(30, Math.max(1, step)),
        special = rewards.some((reward) => reward.type === "cosmetic"),
        rewardAsset = seasonRewardVisual(rewards);
      return `<article class="tier checkpoint ${unlocked ? "unlocked" : "locked"} ${current ? "current" : ""} ${special ? "special" : ""}" data-tier="${tier}"><span class="checkpoint-node">${rewardAsset || claimed ? rewardAsset || iconSvg("check") : unlocked ? iconSvg("gift") : iconSvg("lock")}</span><span class="checkpoint-copy"><small>Steg ${tier}</small><strong>${rewards.map(rewardCopy).join(" + ")}</strong>${special ? "<b>Säsongsexklusiv</b>" : ""}</span>${claimed ? '<span class="checkpoint-status">Hämtad</span>' : unlocked ? `<button data-claim="${tier}">Hämta</button>` : '<span class="checkpoint-status">Låst</span>'}</article>`;
    })
    .join("");
  root.innerHTML = `<section class="season-hero season-summary full-width" lang="sv"><span class="season-aurora" aria-hidden="true"></span><div><span class="eyebrow">Säsong ${info.index + 1}</span><h2>Klinisk rotation</h2><p>Helsingfors <span aria-hidden="true">→</span> Östersjön <span aria-hidden="true">→</span> Stockholm</p></div><span class="season-medallion">${iconSvg("route", 32)}<b>${step}</b><small>av 30</small></span><div class="season-hero-progress"><strong>Steg ${step} av 30</strong><span>${state.seasons.points} säsongspoäng · ${Math.max(0, 28 - info.dayNumber)} dagar kvar</span>${progressBar(remainder, 100, "Till nästa steg")}</div></section>
  <section class="dashboard-card league-summary" lang="sv">${leagueVisual(state.league.tier)}<div><span class="eyebrow">Veckoliga</span><h2>${currentLeague}</h2><div class="summary-line"><strong>${state.league.weeklyXp} XP</strong><span>${targetCopy}: ${league.target} XP</span><span>${league.remaining} XP kvar</span></div>${progressBar(barValue, league.target, barLabel)}</div></section>
  <div class="season-tabs" role="tablist" aria-label="Säsongsinnehåll" lang="sv"><button role="tab" aria-selected="${selected === "rewards"}" aria-controls="reward-track" data-season-panel="rewards">Belöningsspår</button><button role="tab" aria-selected="${selected === "league"}" aria-controls="league" data-season-panel="league">Veckoliga</button></div>
  <section id="reward-track" class="dashboard-card season-detail" role="tabpanel" lang="sv" ${mobile && selected !== "rewards" ? "hidden" : ""}><div class="section-title"><div><span class="eyebrow">Finland → Sverige</span><h2>${iconSvg("route")} Belöningsspår</h2></div>${claimable ? `<button data-claim-all>Hämta alla</button>` : ""}</div><div class="season-route-labels" aria-hidden="true">${decorativeImage(nordicAssets.brand.crossFi, 128, 128)}<span></span>${decorativeImage(nordicAssets.brand.crossSv, 128, 128)}</div><div class="season-path">${tierRows}</div>${seasonShowAll ? "" : `<button type="button" class="show-all-tiers" data-show-all-tiers>Visa alla 30 steg</button>`}</section>
  <section id="league" class="dashboard-card season-detail league-detail" role="tabpanel" lang="sv" ${mobile && selected !== "league" ? "hidden" : ""}>${leagueVisual(state.league.tier, true)}<h2>Veckoliga</h2><div class="league-name">${currentLeague}</div><dl class="league-stats"><div><dt>Veckans XP</dt><dd>${state.league.weeklyXp} XP</dd></div><div><dt>Mål just nu</dt><dd>${targetCopy}: ${league.target} XP</dd></div><div><dt>Återstår</dt><dd>${league.remaining} XP</dd></div></dl>${progressBar(barValue, league.target, barLabel)}${state.league.result ? `<p class="league-result"><strong>Förra resultatet:</strong> ${leagueResultCopy(state.league.result)}</p>` : ""}<p class="league-goal">${iconSvg("progress")} Behåll din liga eller klättra vidare.</p><p class="muted">Ingen påhittad topplista och inga falska motståndare.</p></section>`;
  root.querySelectorAll<HTMLButtonElement>("[data-claim]").forEach((button) =>
    button.addEventListener("click", () => {
      const next = claimSeason(state, Number(button.dataset.claim));
      if (next) persist(next);
    }),
  );
  root
    .querySelector<HTMLButtonElement>("[data-claim-all]")
    ?.addEventListener("click", () => {
      let next = state;
      for (let tier = 1; tier <= 30; tier++)
        next = claimSeason(next, tier) ?? next;
      if (next !== state) persist(next);
    });
  root
    .querySelector<HTMLButtonElement>("[data-show-all-tiers]")
    ?.addEventListener("click", () => {
      seasonShowAll = true;
      renderSeason();
    });
  root
    .querySelectorAll<HTMLButtonElement>("[data-season-panel]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        seasonMobilePanel = button.dataset.seasonPanel as "rewards" | "league";
        history.replaceState(
          null,
          "",
          seasonMobilePanel === "league" ? "#league" : "#reward-track",
        );
        renderSeason();
      }),
    );
}
function render() {
  state = loadProgress();
  renderHome();
  renderProgress();
  renderSettings();
  renderRewards();
  renderSeason();
}

function checkDailyAutoOpen() {
  if (autoOpenChecked || !$("daily-launcher")) return;
  autoOpenChecked = true;
  queueMicrotask(() => {
    const dialog = $<HTMLDialogElement>("daily-overlay"),
      day = today();
    if (!dialog) return;
    const otherModalOpen = [
      ...document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
    ].some((item) => item !== dialog);
    if (
      shouldAutoOpenDailyOverlay({
        pathname: location.pathname,
        localDay: localDayKey(),
        preferences: loadUiPreferences(),
        calmMode: state.settings.calmMode,
        dailyGoalComplete: day.uniqueItemIds.length >= state.settings.dailyGoal,
        dailyQuestsComplete: day.quests.every((quest) => quest.claimed),
        otherModalOpen,
      })
    )
      openDailyOverlay();
  });
}

$<HTMLSelectElement>("daily-goal")?.addEventListener("change", (event) =>
  persist(
    setDailyGoal(
      state,
      Number((event.target as HTMLSelectElement).value) as 5 | 10 | 20 | 30,
    ),
  ),
);
$<HTMLInputElement>("calm-mode")?.addEventListener("change", (event) => {
  const next = structuredClone(state);
  next.settings.calmMode = (event.target as HTMLInputElement).checked;
  persist(next);
  document.documentElement.dataset.calm = String(next.settings.calmMode);
  playSound('ui-tap');
});
$<HTMLInputElement>('sound-enabled')?.addEventListener('change',(event)=>{const enabled=(event.target as HTMLInputElement).checked;if(enabled){saveSoundSettings({...loadSoundSettings(),enabled});playSound('ui-tap');}else{playSound('ui-tap');saveSoundSettings({...loadSoundSettings(),enabled});}});
$<HTMLInputElement>('sound-volume')?.addEventListener('input',(event)=>{const volume=Number((event.target as HTMLInputElement).value)/100;saveSoundSettings({...loadSoundSettings(),volume});const output=$<HTMLOutputElement>('sound-volume-value');if(output)output.value=`${Math.round(volume*100)} %`;});
$<HTMLInputElement>('sound-volume')?.addEventListener('change',()=>playSound('ui-tap'));
$("export-progress")?.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(exportEnvelope(state), null, 2)], {
      type: "application/json",
    }),
    link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `medicinsk-svenska-progress-${localDayKey()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});
$<HTMLInputElement>("import-progress")?.addEventListener(
  "change",
  async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const parsed = parseImport(await file.text()),
      status = $("data-status");
    if (!parsed.ok) {
      if (status) status.textContent = parsed.error;
      return;
    }
    if (confirm("Korvataanko nykyinen edistyminen tuoduilla tiedoilla?")) {
      persist(parsed.state);
      if (status) status.textContent = "Tiedot tuotu.";
    }
  },
);
$("reset-progress")?.addEventListener("click", () => {
  if (
    confirm(
      "Nollataanko kaikki edistymis- ja palkintotiedot? Harjoitussessiot säilyvät.",
    )
  ) {
    state = resetProgress();
    location.reload();
  }
});
$<HTMLDialogElement>("capsule-dialog")?.addEventListener("click", (event) => {
  if ((event.target as HTMLElement).hasAttribute("data-close"))
    (event.currentTarget as HTMLDialogElement).close();
});
$<HTMLButtonElement>("daily-launcher")?.addEventListener(
  "click",
  openDailyOverlay,
);
$<HTMLButtonElement>("daily-overlay-close")?.addEventListener("click", () =>
  closeDailyOverlay({ markDismissed: true, restoreFocus: true }),
);
$<HTMLDialogElement>("daily-overlay")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget)
    closeDailyOverlay({ markDismissed: true, restoreFocus: true });
});
$<HTMLDialogElement>("daily-overlay")?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeDailyOverlay({ markDismissed: true, restoreFocus: true });
});
window.addEventListener("progress-updated", render);
window.addEventListener("storage", (event) => {
  if (event.key === PROGRESS_KEY) render();
});
render();
checkDailyAutoOpen();
