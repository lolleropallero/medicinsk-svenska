import { COSMETICS, DEFAULT_COSMETICS } from "../lib/progress/catalog";
import { loadProgress, saveProgress } from "../lib/progress/storage";
import { notificationCopy } from "../lib/progress/copy";
import {
  achievementBadge,
  cosmeticVisualToken,
  iconSvg,
  leagueBadge,
} from "../lib/visuals";
import { rewardBoxImage, type RewardBoxKind } from "../lib/reward-box-assets";
import { levelProgress } from "../lib/progress/core";
import { requestFeedback } from "../lib/motion/feedback";
import { rewardCopy } from "../lib/progress/copy";
import {
  milestoneFeedback,
  peekPendingMilestoneBatch,
  takePendingMilestoneBatch,
  type MilestoneBatch,
  type QuestMilestone,
} from "../lib/progress/milestones";

let priorHudValues: string[] | null = null;
let milestoneScheduled = false;
let restoreMilestoneFocus: HTMLElement | null = null;

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!));

const questReward = (quest: QuestMilestone) =>
  `+${quest.reward.xp} XP · +${quest.reward.credits} krediter · +${quest.reward.seasonPoints} säsongspoäng`;

function milestoneMarkup(batch: MilestoneBatch) {
  const sections: string[] = [];
  if (batch.levelUp) sections.push(`<section class="milestone-section milestone-level" data-milestone-kind="level">
    <p class="milestone-kicker">Ny nivå</p><strong class="milestone-level-number">${batch.levelUp.to}</strong>
  </section>`);
  if (batch.achievements.length) {
    const heading = batch.achievements.length === 1 ? 'Prestation upplåst' : 'Prestationer upplåsta';
    sections.push(`<section class="milestone-section milestone-achievements" data-milestone-kind="achievement">
      <h3>${heading}</h3><div class="milestone-list">${batch.achievements.map((achievement) => {
        const asset = achievementBadge(achievement.id);
        return `<article class="milestone-item achievement-item">${asset ? image(asset, 'milestone-achievement-badge') : ''}<div><strong>${escapeHtml(achievement.name)}</strong><p>${escapeHtml(achievement.description)}</p><small>Belöning: ${escapeHtml(rewardCopy(achievement.reward))}</small></div></article>`;
      }).join('')}</div>
    </section>`);
  }
  const questSection = (heading: string, kind: string, quests: QuestMilestone[]) => quests.length
    ? `<section class="milestone-section milestone-quests" data-milestone-kind="${kind}"><h3>${heading}</h3><div class="milestone-list">${quests.map((quest) => `<article class="milestone-item quest-item"><span class="milestone-check" aria-hidden="true">✓</span><div><strong>${escapeHtml(quest.name)}</strong><small>${escapeHtml(questReward(quest))}</small></div></article>`).join('')}</div></section>`
    : '';
  sections.push(questSection('Dagens mål klart', 'daily-quest', batch.completedDailyQuests));
  sections.push(questSection('Veckouppdrag klart', 'weekly-quest', batch.completedWeeklyQuests));
  return sections.join('');
}

function visibleFocusableFallback() {
  return [...document.querySelectorAll<HTMLElement>('main button:not(:disabled), main input:not(:disabled), main a[href]')]
    .find((element) => !element.hidden && element.getClientRects().length > 0) ?? document.getElementById('sisalto');
}

function closeMilestoneOverlay() {
  const dialog = document.getElementById('milestone-overlay') as HTMLDialogElement | null;
  if (!dialog?.open) return;
  dialog.close();
  dialog.removeAttribute('lang');
  requestFeedback('overlay-close', dialog, null);
  const target = restoreMilestoneFocus?.isConnected && restoreMilestoneFocus.getClientRects().length
    ? restoreMilestoneFocus : visibleFocusableFallback();
  target?.focus({ preventScroll: true });
  restoreMilestoneFocus = null;
  scheduleMilestonePresentation();
}

function presentPendingMilestone() {
  milestoneScheduled = false;
  if (!peekPendingMilestoneBatch()) return;
  const dialog = document.getElementById('milestone-overlay') as HTMLDialogElement | null;
  const content = document.getElementById('milestone-overlay-content');
  const competingDialog = document.querySelector<HTMLDialogElement>('dialog[open]:not(#milestone-overlay)');
  if (!dialog || !content) return;
  if (dialog.open) return;
  if (competingDialog) {
    competingDialog.addEventListener('close', scheduleMilestonePresentation, { once: true });
    return;
  }
  const batch = takePendingMilestoneBatch();
  if (!batch) return;
  const feedback = milestoneFeedback(batch);
  if (!feedback) return;
  content.innerHTML = milestoneMarkup(batch);
  dialog.dataset.milestoneCount = String(
    Number(Boolean(batch.levelUp)) + batch.achievements.length
      + batch.completedDailyQuests.length + batch.completedWeeklyQuests.length,
  );
  restoreMilestoneFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog.lang = 'sv';
  dialog.showModal();
  document.getElementById('milestone-overlay-continue')?.focus({ preventScroll: true });
  // The visible dialog and the approved fanfare share this single semantic request.
  requestFeedback(feedback, dialog);
}

function scheduleMilestonePresentation() {
  if (milestoneScheduled || !peekPendingMilestoneBatch()) return;
  milestoneScheduled = true;
  // Progression renderers finish synchronously; the microtask hands off only after that state is settled.
  queueMicrotask(presentPendingMilestone);
}

function apply() {
  const state = loadProgress();
  const root = document.documentElement;
  const theme = state.inventory.equipped.theme;
  root.dataset.theme = COSMETICS.some(
    (c) => c.id === theme && c.type === "theme",
  )
    ? cosmeticVisualToken("theme", theme)
    : DEFAULT_COSMETICS.theme;
  root.dataset.cardStyle = cosmeticVisualToken(
    "cardStyle",
    state.inventory.equipped.cardStyle,
  );
  root.dataset.progressFrame = cosmeticVisualToken(
    "progressFrame",
    state.inventory.equipped.progressFrame,
  );
  root.dataset.calm = String(state.settings.calmMode);
  const host = document.getElementById("reward-notifications");
  const next = state.notifications[0];
  if (host)
    host.innerHTML = next
      ? `<div class="notification" data-notification-kind="${next.kind}" role="status">${notificationVisual(next)}<span lang="sv"><strong>${notificationCopy(next)}</strong><small>Belöningen har lagts till.</small></span><button type="button" aria-label="Stäng meddelandet" lang="sv">Stäng</button></div>`
      : "";
  host?.querySelector("button")?.addEventListener("click", () => {
    const current = loadProgress();
    current.notifications = current.notifications.filter(
      (item) => item.id !== next?.id,
    );
    saveProgress(current);
    apply();
  });
}
const image = (src: string, className = "") =>
  `<img${className ? ` class="${className}"` : ""} src="${src}" alt="" aria-hidden="true" decoding="async">`;
const compactBox = (kind: RewardBoxKind = "standard") => {
  const asset = rewardBoxImage(kind, "small");
  return `<span class="compact-reward-box compact-box-${kind}" aria-hidden="true"><img class="compact-box-image" src="${asset.src}" width="${asset.width}" height="${asset.height}" alt="" aria-hidden="true" decoding="async"></span>`;
};
function notificationVisual(
  next: ReturnType<typeof loadProgress>["notifications"][number],
) {
  if (next.kind === "achievement") {
    const asset = achievementBadge(next.id.replace(/^achievement:/, ""));
    return asset
      ? image(asset, "notification-achievement")
      : iconSvg("level", 32);
  }
  if (next.kind === "league")
    return image(leagueBadge(next.result.tier).asset, "notification-league");
  if (next.kind === "golden-box") return compactBox("golden");
  if (
    next.kind === "daily-goal" ||
    next.kind === "daily-quest" ||
    next.kind === "weekly-quest"
  )
    return compactBox("standard");
  return iconSvg("gift", 32);
}
function hud() {
  const state = loadProgress(),
    host = document.getElementById("metagame-hud");
  if (!host) return;
  const level = levelProgress(state.lifetime.xp),
    boxes = state.inventory.capsules.filter((item) => !item.openedAt).length;
  host.innerHTML = `<div class="hud-grid" lang="sv">
    <a class="hud-stat" href="/edistyminen/" aria-label="Nivå ${level.level}, ${state.lifetime.xp} XP"><span class="hud-stat__icon" aria-hidden="true">${iconSvg("level")}</span><span class="hud-stat__copy"><span class="hud-stat__label">Nivå</span><strong class="hud-stat__value">${level.level}</strong><small class="hud-stat__secondary">${state.lifetime.xp} <abbr title="erfarenhetspoäng">XP</abbr></small></span></a>
    <a class="hud-stat" href="/edistyminen/" aria-label="Svit ${state.streak.current} ${state.streak.current === 1 ? "dag" : "dagar"}"><span class="hud-stat__icon" aria-hidden="true">${iconSvg("streak")}</span><span class="hud-stat__copy"><span class="hud-stat__label">Svit</span><strong class="hud-stat__value">${state.streak.current}</strong><small class="hud-stat__secondary">${state.streak.current === 1 ? "dag" : "dagar"}</small></span></a>
    <a class="hud-stat" href="/palkinnot/" aria-label="${state.inventory.credits} krediter"><span class="hud-stat__icon" aria-hidden="true">${iconSvg("credits")}</span><span class="hud-stat__copy"><span class="hud-stat__label">Krediter</span><strong class="hud-stat__value">${state.inventory.credits}</strong></span></a>
    <a class="hud-stat hud-boxes ${boxes ? "has-boxes" : ""}" href="/palkinnot/#unopened-boxes" aria-label="${boxes} ${boxes === 1 ? "oöppnad belöning" : "oöppnade belöningar"}"><span class="hud-stat__icon hud-stat__box" aria-hidden="true">${compactBox("standard")}</span><span class="hud-stat__copy"><span class="hud-stat__label">Belöningar</span><strong class="hud-stat__value">${boxes}</strong>${boxes ? '<small class="hud-stat__secondary">Öppna</small>' : ""}</span></a>
  </div>`;
  const values = [String(level.level), String(state.streak.current), String(state.inventory.credits), String(boxes)];
  if (priorHudValues) host.querySelectorAll<HTMLElement>('.hud-stat__value').forEach((node,index) => {
    if (priorHudValues?.[index] !== values[index]) requestFeedback('hud-increment', node, null);
  });
  priorHudValues = values;
}
function refresh() {
  apply();
  hud();
  const dialog = document.getElementById('milestone-overlay') as HTMLDialogElement | null;
  if (dialog && dialog.dataset.bound !== 'true') {
    dialog.dataset.bound = 'true';
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeMilestoneOverlay();
    });
  }
  scheduleMilestonePresentation();
}
document.addEventListener('click', (event) => {
  if ((event.target as Element | null)?.closest('#milestone-overlay-continue')) closeMilestoneOverlay();
});
document.addEventListener("astro:page-load", refresh);
window.addEventListener('milestone-batch-pending', scheduleMilestonePresentation);
window.addEventListener("progress-updated", refresh);
window.addEventListener("storage", (event) => {
  if (event.key === "medicinsk-svenska.progress.v1") refresh();
});
