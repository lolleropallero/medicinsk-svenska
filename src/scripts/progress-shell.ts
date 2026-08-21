import { COSMETICS, DEFAULT_COSMETICS } from '../lib/progress/catalog';
import { loadProgress, saveProgress } from '../lib/progress/storage';
import { notificationCopy } from '../lib/progress/copy';
import { levelProgress } from '../lib/progress/core';

function apply(){const state=loadProgress();const root=document.documentElement;const theme=state.inventory.equipped.theme;
  root.dataset.theme=COSMETICS.some(c=>c.id===theme&&c.type==='theme')?theme:DEFAULT_COSMETICS.theme;
  root.dataset.cardStyle=state.inventory.equipped.cardStyle;root.dataset.progressFrame=state.inventory.equipped.progressFrame;root.dataset.calm=String(state.settings.calmMode);
  const host=document.getElementById('reward-notifications');const next=state.notifications[0];if(host)host.innerHTML=next?`<div class="notification" role="status"><span lang="sv">${notificationCopy(next)}</span><button type="button" aria-label="Stäng meddelandet" lang="sv">Stäng</button></div>`:'';
  host?.querySelector('button')?.addEventListener('click',()=>{const current=loadProgress();current.notifications=current.notifications.filter(item=>item.id!==next?.id);saveProgress(current);apply();});
}
function hud(){const state=loadProgress(),host=document.getElementById('metagame-hud');if(!host)return;const level=levelProgress(state.lifetime.xp),boxes=state.inventory.capsules.filter(item=>!item.openedAt).length;host.innerHTML=`<div class="hud-grid" lang="sv"><a href="/edistyminen/"><span>Nivå</span><strong>${level.level}</strong><small>${state.lifetime.xp} <abbr title="erfarenhetspoäng">XP</abbr></small></a><a href="/edistyminen/"><span>Svit</span><strong>${state.streak.current}</strong><small>${state.streak.current===1?'dag':'dagar'}</small></a><a href="/palkinnot/"><span>Krediter</span><strong>${state.inventory.credits}</strong></a><a class="hud-boxes ${boxes?'has-boxes':''}" href="/palkinnot/#unopened-boxes"><span>Lådor</span><strong>${boxes}</strong>${boxes?'<small>Öppna</small>':''}</a></div>`;}
function refresh(){apply();hud();}
refresh();window.addEventListener('progress-updated',refresh);window.addEventListener('storage',(event)=>{if(event.key==='medicinsk-svenska.progress.v1')refresh();});
