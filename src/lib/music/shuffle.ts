import type { MusicTrackId } from './types';

export type RandomSource=()=>number;
export function shuffleTracks(tracks:readonly MusicTrackId[],rng:RandomSource=Math.random):MusicTrackId[]{
  const result=[...tracks];
  for(let index=result.length-1;index>0;index--){const other=Math.floor(Math.min(.999999999,Math.max(0,rng()))*(index+1));[result[index],result[other]]=[result[other]!,result[index]!];}
  return result;
}
export function createShuffleBag(tracks:readonly MusicTrackId[],previous:MusicTrackId|undefined,rng:RandomSource=Math.random):MusicTrackId[]{
  const bag=shuffleTracks(tracks,rng);
  if(previous&&bag.length>1&&bag[0]===previous){const swap=1+Math.floor(Math.min(.999999999,Math.max(0,rng()))*(bag.length-1));[bag[0],bag[swap]]=[bag[swap]!,bag[0]!];}
  return bag;
}
export function seededRandom(seed:number):RandomSource{return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
