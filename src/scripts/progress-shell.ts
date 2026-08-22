import { COSMETICS, DEFAULT_COSMETICS } from "../lib/progress/catalog";
import { loadProgress, saveProgress } from "../lib/progress/storage";
import { notificationCopy } from "../lib/progress/copy";
import {
  achievementBadge,
  cosmeticVisualToken,
  iconSvg,
  leagueBadge,
} from "../lib/visuals";
import { nordicAssets } from "../lib/nordic-assets";
import { levelProgress } from "../lib/progress/core";

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
      ? `<div class="notification" role="status">${notificationVisual(next)}<span lang="sv"><strong>${notificationCopy(next)}</strong><small>Belöningen har lagts till.</small></span><button type="button" aria-label="Stäng meddelandet" lang="sv">Stäng</button></div>`
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
const compactBox = (kind: "standard" | "golden" | "legendary" = "standard") => {
  const crosses =
      kind === "standard"
        ? [nordicAssets.rewardPrimitives.crossFi]
        : kind === "golden"
          ? [nordicAssets.rewardPrimitives.crossSv]
          : [
              nordicAssets.rewardPrimitives.crossFi,
              nordicAssets.rewardPrimitives.crossSv,
            ],
    seal =
      kind === "standard"
        ? nordicAssets.rewardPrimitives.sealCommon
        : kind === "golden"
          ? nordicAssets.rewardPrimitives.sealGolden
          : nordicAssets.rewardPrimitives.sealLegendary;
  return `<span class="compact-reward-box compact-box-${kind}" aria-hidden="true"><span class="compact-box-surface">${crosses.map((src) => image(src, "compact-box-cross")).join("")}${image(seal, "compact-box-seal")}</span></span>`;
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
  host.innerHTML = `<div class="hud-grid" lang="sv"><a href="/edistyminen/">${iconSvg("level")}<span>Nivå</span><strong>${level.level}</strong><small>${state.lifetime.xp} <abbr title="erfarenhetspoäng">XP</abbr></small></a><a href="/edistyminen/">${iconSvg("streak")}<span>Svit</span><strong>${state.streak.current}</strong><small>${state.streak.current === 1 ? "dag" : "dagar"}</small></a><a href="/palkinnot/">${iconSvg("credits")}<span>Krediter</span><strong>${state.inventory.credits}</strong></a><a class="hud-boxes ${boxes ? "has-boxes" : ""}" href="/palkinnot/#unopened-boxes">${compactBox("standard")}<span>Lådor</span><strong>${boxes}</strong>${boxes ? "<small>Öppna</small>" : ""}</a></div>`;
}
function refresh() {
  apply();
  hud();
}
refresh();
window.addEventListener("progress-updated", refresh);
window.addEventListener("storage", (event) => {
  if (event.key === "medicinsk-svenska.progress.v1") refresh();
});
