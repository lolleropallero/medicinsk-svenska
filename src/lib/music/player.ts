import { MUSIC_CATALOG, MUSIC_TRACK_IDS } from './catalog';
import { effectiveMusicGain, equalPowerCrossfade } from './gain';
import { loadMusicSettings } from './settings';
import { createShuffleBag } from './shuffle';
import type { MusicSession, MusicTrackId } from './types';
import type { SoundEffect } from '../sound/types';

const SESSION_KEY='medicinsk-svenska.music-session.v1',UNLOCK_KEY='medicinsk-svenska.music-unlocked.v1',CROSSFADE_SECONDS=2.5;
const majorEffects=new Set<SoundEffect>(['quest-complete','achievement','level-up','reward-reveal']);
type Channel={audio:HTMLAudioElement;trackId:MusicTrackId|undefined;mix:number};
let installed=false,unlocked=false,playing=false,starting=false,crossfading=false,suspendedForVisibility=false,activeIndex=0,ducked=false,lastDuckAt=-Infinity,restoreTimer=0,frame=0,playbackEpoch=0;
let session:MusicSession|null=null,channels:Channel[]=[],pendingBag:MusicTrackId[]|null=null;

const isTrackId=(value:unknown):value is MusicTrackId=>typeof value==='string'&&(MUSIC_TRACK_IDS as readonly string[]).includes(value);
export function parseMusicSession(raw:string|null):MusicSession|null{
  if(!raw)return null;try{const value=JSON.parse(raw) as Partial<MusicSession>,position=value.position,currentTime=value.currentTime;if(value.schemaVersion!==1||!Array.isArray(value.bag)||value.bag.length!==5||new Set(value.bag).size!==5||!value.bag.every(isTrackId)||!isTrackId(value.currentTrack)||typeof position!=='number'||!Number.isInteger(position)||position<0||position>=5||value.bag[position]!==value.currentTrack||typeof currentTime!=='number'||!Number.isFinite(currentTime)||currentTime<0)return null;return{schemaVersion:1,bag:value.bag,position,currentTrack:value.currentTrack,currentTime,failed:Array.isArray(value.failed)?value.failed.filter(isTrackId):[],...(isTrackId(value.previousTrack)?{previousTrack:value.previousTrack}:{})};}catch{return null;}
}
function freshSession():MusicSession{const bag=createShuffleBag(MUSIC_TRACK_IDS,undefined);return{schemaVersion:1,bag,position:0,currentTrack:bag[0]!,currentTime:0,failed:[]};}
function persist(){if(!session)return;const active=channels[activeIndex];if(active?.trackId===session.currentTrack&&Number.isFinite(active.audio.currentTime))session.currentTime=active.audio.currentTime;try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));}catch{}}
function calm(){return document.documentElement.dataset.calm==='true';}
function channelGain(channel:Channel){if(!channel.trackId)return 0;return effectiveMusicGain(loadMusicSettings().volume,MUSIC_CATALOG[channel.trackId].normalizationGain,calm(),ducked)*channel.mix;}
function setGains(){for(const channel of channels)channel.audio.volume=Math.min(1,Math.max(0,channelGain(channel)));}
function rampGains(duration:number){cancelAnimationFrame(frame);const starts=channels.map(({audio})=>audio.volume),started=performance.now();const tick=(now:number)=>{const progress=Math.min(1,Math.max(0,(now-started)/duration));for(let index=0;index<channels.length;index++){const target=channelGain(channels[index]!);const gain=starts[index]!+(target-starts[index]!)*progress;channels[index]!.audio.volume=Math.min(1,Math.max(0,gain));}if(progress<1)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);}
function remainingTracks(){return MUSIC_TRACK_IDS.filter(id=>!session?.failed.includes(id));}
function nextTrack():MusicTrackId|undefined{
  if(!session)return undefined;let position=session.position+1;
  while(position<session.bag.length&&session.failed.includes(session.bag[position]!))position++;
  if(position<session.bag.length)return session.bag[position];
  const available=remainingTracks();if(!available.length)return undefined;
  pendingBag=(pendingBag??createShuffleBag(available,session.currentTrack)).filter(id=>!session!.failed.includes(id));
  if(!pendingBag.length)pendingBag=createShuffleBag(available,session.currentTrack);
  return pendingBag[0];
}
function prepare(channel:Channel,id:MusicTrackId,preload:'metadata'|'auto'='metadata'){
  if(channel.trackId===id){channel.audio.preload=preload;return;}
  channel.trackId=undefined;channel.mix=0;channel.audio.pause();channel.audio.removeAttribute('src');channel.audio.load();channel.trackId=id;channel.audio.preload=preload;channel.audio.src=MUSIC_CATALOG[id].src;channel.audio.dataset.trackId=id;channel.audio.load();setGains();
}
function prepareNext(preload:'metadata'|'auto'='metadata'){const id=nextTrack();if(id)prepare(channels[1-activeIndex]!,id,preload);}
async function begin(){
  if(document.hidden||!unlocked||playing||starting||!loadMusicSettings().enabled||loadMusicSettings().volume<=0)return;
  starting=true;const epoch=playbackEpoch;
  session??=parseMusicSession(sessionStorage.getItem(SESSION_KEY))??freshSession();
  const active=channels[activeIndex]!;prepare(active,session.currentTrack,'auto');active.mix=1;setGains();
  const seek=()=>{if(session&&active.trackId===session.currentTrack&&session.currentTime>0&&session.currentTime<MUSIC_CATALOG[session.currentTrack].duration-1)active.audio.currentTime=session.currentTime;};
  if(active.audio.readyState>=1)seek();else active.audio.addEventListener('loadedmetadata',seek,{once:true});
  try{await active.audio.play();if(document.hidden||epoch!==playbackEpoch){active.audio.pause();playing=false;return;}playing=true;prepareNext('metadata');persist();}catch{playing=false;}finally{starting=false;}
}
function finishAdvance(outgoing:Channel,incoming:Channel,next:MusicTrackId){
  outgoing.audio.pause();outgoing.trackId=undefined;outgoing.audio.removeAttribute('src');outgoing.audio.load();outgoing.mix=0;
  activeIndex=1-activeIndex;session!.previousTrack=session!.currentTrack;const oldBagHasNext=session!.bag.slice(session!.position+1).some(id=>!session!.failed.includes(id));session!.currentTrack=next;let found=session!.bag.indexOf(next);if(!oldBagHasNext&&pendingBag?.[0]===next){session!.bag=pendingBag;pendingBag=null;found=0;}session!.position=found;session!.currentTime=incoming.audio.currentTime;incoming.mix=1;crossfading=false;playing=true;setGains();prepareNext('metadata');persist();
}
async function advance(useFade=true){
  if(document.hidden||!session||crossfading)return;const epoch=playbackEpoch,outgoing=channels[activeIndex]!,incoming=channels[1-activeIndex]!,next=incoming.trackId??nextTrack();if(!next){playing=false;outgoing.audio.pause();return;}prepare(incoming,next,'auto');
  try{incoming.audio.currentTime=0;incoming.mix=0;setGains();await incoming.audio.play();if(document.hidden||epoch!==playbackEpoch){incoming.audio.pause();return;}}catch{if(document.hidden||epoch!==playbackEpoch)return;markFailed(next);return;}
  crossfading=true;const duration=useFade?CROSSFADE_SECONDS*1000:120,started=performance.now();
  const tick=(now:number)=>{if(document.hidden||epoch!==playbackEpoch)return;const progress=Math.min(1,(now-started)/duration),mix=equalPowerCrossfade(progress);outgoing.mix=mix.outgoing;incoming.mix=mix.incoming;setGains();if(progress<1)requestAnimationFrame(tick);else finishAdvance(outgoing,incoming,next);};requestAnimationFrame(tick);
}
function markFailed(id:MusicTrackId){
  if(!session)return;if(!session.failed.includes(id))session.failed.push(id);const failedChannel=channels.find(channel=>channel.trackId===id);failedChannel?.audio.pause();if(failedChannel){failedChannel.trackId=undefined;failedChannel.audio.removeAttribute('src');failedChannel.audio.load();}
  if(session.failed.length>=MUSIC_TRACK_IDS.length){playing=false;channels.forEach(channel=>channel.audio.pause());persist();return;}
  crossfading=false;if(session.currentTrack===id)void advance(false);else prepareNext('auto');persist();
}
function monitorPlayback(){
  if(document.hidden||!playing||crossfading||!session)return;const active=channels[activeIndex]!,remaining=active.audio.duration-active.audio.currentTime;if(Number.isFinite(remaining)&&remaining<=15)prepareNext('auto');if(Number.isFinite(remaining)&&remaining<=CROSSFADE_SECONDS&&active.audio.currentTime>0)void advance(true);persist();
}
function pauseSmooth(){playbackEpoch++;playing=false;starting=false;crossfading=false;const active=channels[activeIndex];if(!active)return;channels[1-activeIndex]!.mix=0;active.mix=0;rampGains(200);window.setTimeout(()=>{channels.forEach(channel=>channel.audio.pause());persist();},220);}
function onSettings(){const settings=loadMusicSettings();if(!settings.enabled||settings.volume<=0)pauseSmooth();else if(unlocked&&!playing){channels[activeIndex]!.mix=1;void begin();}else rampGains(90);}
function onSound(event:CustomEvent<{effect:SoundEffect;audible:boolean}>){if(!event.detail.audible||!majorEffects.has(event.detail.effect))return;const now=performance.now();if(now-lastDuckAt<250)return;lastDuckAt=now;ducked=true;rampGains(100);clearTimeout(restoreTimer);restoreTimer=window.setTimeout(()=>{ducked=false;rampGains(600);},650);}
function suspendPlayback(){
  if(playing||starting||crossfading)suspendedForVisibility=true;playbackEpoch++;cancelAnimationFrame(frame);channels.forEach(channel=>channel.audio.pause());playing=false;starting=false;crossfading=false;
  if(channels.length){channels[activeIndex]!.mix=1;channels[1-activeIndex]!.mix=0;setGains();}persist();
}
function onVisibility(){if(document.hidden)suspendPlayback();else if(suspendedForVisibility){suspendedForVisibility=false;void begin();}}

export function startMusicPlayer(host:HTMLElement=document.getElementById('music-player')!){
  if(installed||!host)return;installed=true;session=parseMusicSession(sessionStorage.getItem(SESSION_KEY));
  channels=[0,1].map(index=>{const audio=document.createElement('audio');audio.dataset.musicChannel=String(index);audio.setAttribute('aria-hidden','true');audio.preload='none';audio.addEventListener('error',()=>{const id=channels[index]?.trackId;if(id)markFailed(id);});audio.addEventListener('ended',()=>{if(index===activeIndex)void advance(false);});host.append(audio);return{audio,trackId:undefined,mix:index===0?1:0};});
  const unlock=()=>{if(!unlocked){unlocked=true;try{sessionStorage.setItem(UNLOCK_KEY,'true');}catch{}}if(!playing)void begin();};window.addEventListener('pointerdown',unlock,{capture:true});window.addEventListener('keydown',unlock,{capture:true});window.addEventListener('music-settings-changed',onSettings);window.addEventListener('sound-effect-requested',onSound as EventListener);document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pagehide',suspendPlayback);window.addEventListener('pageshow',onVisibility);window.addEventListener('progress-updated',()=>rampGains(200));
  new MutationObserver(()=>rampGains(200)).observe(document.documentElement,{attributes:true,attributeFilter:['data-calm']});window.setInterval(monitorPlayback,500);
  window.__musicTest={snapshot:()=>({installed,unlocked,playing,crossfading,suspendedForVisibility,currentTrack:session?.currentTrack,bag:session?.bag,position:session?.position,failed:session?.failed,gains:channels.map(channel=>channel.audio.volume),times:channels.map(channel=>channel.audio.currentTime),paused:channels.map(channel=>channel.audio.paused),sources:MUSIC_TRACK_IDS.map(id=>MUSIC_CATALOG[id].src),calm:calm(),ducked}),forceNext:()=>advance(false),fail:(id)=>markFailed(id)};
  try{if(sessionStorage.getItem(UNLOCK_KEY)==='true'){unlocked=true;void begin();}}catch{}
}

declare global { interface Window { __musicTest?:{snapshot:()=>unknown;forceNext:()=>Promise<void>;fail:(id:MusicTrackId)=>void} } }
