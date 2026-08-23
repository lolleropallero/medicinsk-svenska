import { describe,expect,it } from 'vitest';
import { MUSIC_CATALOG,MUSIC_TRACK_IDS } from '../../src/lib/music/catalog';
import { CALM_MUSIC_MULTIPLIER,DUCK_MUSIC_MULTIPLIER,effectiveMusicGain,equalPowerCrossfade } from '../../src/lib/music/gain';
import { parseMusicSession } from '../../src/lib/music/player';
import { createShuffleBag,seededRandom } from '../../src/lib/music/shuffle';

describe('background music catalog',()=>{
  it('contains exactly the five generic local tracks without titles',()=>{
    expect(MUSIC_TRACK_IDS).toEqual(['music-01','music-02','music-03','music-04','music-05']);
    expect(Object.keys(MUSIC_CATALOG)).toEqual([...MUSIC_TRACK_IDS]);
    for(const track of Object.values(MUSIC_CATALOG)){
      expect(track.src).not.toMatch(/^https?:/);expect(track.duration).toBeGreaterThan(0);
      expect(track.normalizationGain).toBeGreaterThan(0);expect(track.normalizationGain).toBeLessThanOrEqual(1);
      expect(track).not.toHaveProperty('title');
    }
  });
  it('creates complete seeded cycles with no immediate cycle-boundary repeat',()=>{
    for(let seed=0;seed<100;seed++){
      const rng=seededRandom(seed),first=createShuffleBag(MUSIC_TRACK_IDS,undefined,rng),second=createShuffleBag(MUSIC_TRACK_IDS,first.at(-1),rng);
      expect(new Set(first)).toEqual(new Set(MUSIC_TRACK_IDS));expect(new Set(second)).toEqual(new Set(MUSIC_TRACK_IDS));
      expect(first).toHaveLength(5);expect(second).toHaveLength(5);expect(second[0]).not.toBe(first[4]);
    }
  });
  it('applies user, normalization, calm and duck gains independently',()=>{
    expect(CALM_MUSIC_MULTIPLIER).toBe(.60);expect(DUCK_MUSIC_MULTIPLIER).toBe(.40);
    expect(effectiveMusicGain(.20,.50,false,false)).toBeCloseTo(.10);
    expect(effectiveMusicGain(.20,.50,true,false)).toBeCloseTo(.06);
    expect(effectiveMusicGain(.20,.50,false,true)).toBeCloseTo(.04);
  });
  it('uses equal-power endpoints and midpoint',()=>{
    expect(equalPowerCrossfade(0)).toEqual({outgoing:1,incoming:0});expect(equalPowerCrossfade(1).outgoing).toBeCloseTo(0);
    expect(equalPowerCrossfade(.5).outgoing).toBeCloseTo(Math.SQRT1_2);expect(equalPowerCrossfade(.5).incoming).toBeCloseTo(Math.SQRT1_2);
  });
  it('validates session-scoped playback state safely',()=>{
    const bag=[...MUSIC_TRACK_IDS];expect(parseMusicSession(JSON.stringify({schemaVersion:1,bag,position:2,currentTrack:'music-03',currentTime:12,failed:[]}))?.currentTime).toBe(12);
    expect(parseMusicSession('{broken')).toBeNull();expect(parseMusicSession(JSON.stringify({schemaVersion:1,bag,position:0,currentTrack:'music-03',currentTime:0,failed:[]}))).toBeNull();
  });
});
