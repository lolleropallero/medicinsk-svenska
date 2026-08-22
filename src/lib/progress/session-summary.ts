import { loadProgress } from './storage';
import { sessionRewardCopy } from './copy';
import { nordicAssets } from '../nordic-assets';

export function showSessionRewards(containerId:string,sessionId:string){const container=document.getElementById(containerId);if(!container)return;const rewards=loadProgress().sessionRewards[sessionId]??[],box=rewards.find(value=>value.kind==='golden-box'||value.kind==='standard-box'),boxKind=box?.kind==='golden-box'?'golden':'standard';container.innerHTML=rewards.length?`<h2 lang="sv">Belöningar</h2>${box?`<img class="session-reward-box" src="${nordicAssets.rewardBoxes[boxKind]}" width="360" height="320" alt="" aria-hidden="true" decoding="async">`:''}<ul lang="sv">${rewards.map(value=>`<li>${sessionRewardCopy(value)}</li>`).join('')}</ul>${box?`<a class="button primary" lang="sv" href="/palkinnot/#unopened-boxes">Öppna lådan</a>`:''}`:'';container.hidden=rewards.length===0;}
