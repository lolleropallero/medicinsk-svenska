import { dispatchProgress } from './storage';
import type { ExerciseMode } from './types';

const LEASE_KEY='medicinsk-svenska.progress.activity-lease.v1';
const LEASE_MS=20_000, INACTIVE_MS=90_000, FLUSH_MS=15_000;
export interface ActiveTimeOptions {mode:ExerciseMode;sessionId:()=>string;eligible:()=>boolean;now?:()=>number;storage?:Storage}
export function startActiveTime(options:ActiveTimeOptions){
  const tabId=crypto.randomUUID(),now=options.now??Date.now,storage=options.storage??localStorage,controller=new AbortController();let lastInteraction=now(),lastAccounted=now(),sequence=0;
  const interact=()=>{lastInteraction=now();};
  const ownsLease=(time:number)=>{try{const lease=JSON.parse(storage.getItem(LEASE_KEY)??'null') as {tabId?:string;expiresAt?:number}|null;if(!lease||!lease.expiresAt||lease.expiresAt<time||lease.tabId===tabId){storage.setItem(LEASE_KEY,JSON.stringify({tabId,expiresAt:time+LEASE_MS}));return true;}return false;}catch{return true;}};
  const flush=()=>{const time=now(),start=lastAccounted;lastAccounted=time;if(document.hidden||!options.eligible()||time-lastInteraction>INACTIVE_MS||!ownsLease(time))return;const duration=Math.min(FLUSH_MS,Math.max(0,time-start));if(duration)dispatchProgress({type:'active-study',eventId:`active:${options.sessionId()}:${tabId}:${sequence++}`,sessionId:options.sessionId(),mode:options.mode,durationMs:duration,occurredAt:time},storage);};
  const timer=window.setInterval(flush,10_000);['pointerdown','keydown','input'].forEach(type=>document.addEventListener(type,interact,{passive:true,signal:controller.signal}));document.addEventListener('visibilitychange',flush,{signal:controller.signal});window.addEventListener('pagehide',flush,{signal:controller.signal});
  return {interact,flush,stop(){window.clearInterval(timer);flush();controller.abort();try{const lease=JSON.parse(storage.getItem(LEASE_KEY)??'null');if(lease?.tabId===tabId)storage.removeItem(LEASE_KEY);}catch{/* optional */}}};
}
