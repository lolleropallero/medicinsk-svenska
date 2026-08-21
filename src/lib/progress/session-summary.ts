import { loadProgress } from './storage';

export function showSessionRewards(containerId:string,sessionId:string){const container=document.getElementById(containerId);if(!container)return;const rewards=loadProgress().sessionRewards[sessionId]??[];container.innerHTML=rewards.length?`<h2>Edistyminen ja palkinnot</h2><ul>${rewards.map(value=>`<li>${value}</li>`).join('')}</ul>`:'';container.hidden=rewards.length===0;}
