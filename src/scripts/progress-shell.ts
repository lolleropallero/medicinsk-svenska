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

let priorHudValues: string[] | null = null;

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
}
document.addEventListener("astro:page-load", refresh);
window.addEventListener("progress-updated", refresh);
window.addEventListener("storage", (event) => {
  if (event.key === "medicinsk-svenska.progress.v1") refresh();
});
