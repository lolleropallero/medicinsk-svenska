import { COSMETICS, DEFAULT_COSMETICS } from '../lib/progress/catalog';
import { loadProgress, saveProgress } from '../lib/progress/storage';

function apply(){const state=loadProgress();const root=document.documentElement;const theme=state.inventory.equipped.theme;
  root.dataset.theme=COSMETICS.some(c=>c.id===theme&&c.type==='theme')?theme:DEFAULT_COSMETICS.theme;
  root.dataset.cardStyle=state.inventory.equipped.cardStyle;root.dataset.progressFrame=state.inventory.equipped.progressFrame;root.dataset.calm=String(state.settings.calmMode);
  const host=document.getElementById('reward-notifications');const next=state.notifications[0];if(host)host.innerHTML=next?`<div class="notification" role="status"><span>${next.message}</span><button type="button" aria-label="Sulje ilmoitus">Sulje</button></div>`:'';
  host?.querySelector('button')?.addEventListener('click',()=>{const current=loadProgress();current.notifications=current.notifications.filter(item=>item.id!==next?.id);saveProgress(current);apply();});
}
apply();window.addEventListener('storage',(event)=>{if(event.key==='medicinsk-svenska.progress.v1')apply();});
