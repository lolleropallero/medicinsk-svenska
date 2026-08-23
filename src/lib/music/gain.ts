export const CALM_MUSIC_MULTIPLIER=.60;
export const DUCK_MUSIC_MULTIPLIER=.40;
export function effectiveMusicGain(userVolume:number,normalizationGain:number,calm:boolean,ducked:boolean){
  return Math.min(1,Math.max(0,userVolume))*Math.min(1,Math.max(0,normalizationGain))*(calm?CALM_MUSIC_MULTIPLIER:1)*(ducked?DUCK_MUSIC_MULTIPLIER:1);
}
export function equalPowerCrossfade(progress:number){const value=Math.min(1,Math.max(0,progress));return{outgoing:Math.cos(value*Math.PI/2),incoming:Math.sin(value*Math.PI/2)};}
