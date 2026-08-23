import { describe,expect,it } from 'vitest';
import { AUDIO_FILENAMES,CALM_ALLOWED,effectiveVolume,SOUND_CATALOG,SOUND_EFFECTS,SOUND_GAINS } from '../../src/lib/sound/catalog';
import { canPlaySound,resetSoundPlayerForTests,selectMilestone,unlockSound } from '../../src/lib/sound/player';

describe('approved sound system',()=>{
  it('maps exactly ten semantic IDs to eight physical OGGs',()=>{
    expect(SOUND_EFFECTS).toHaveLength(10);expect(new Set(SOUND_EFFECTS).size).toBe(10);expect(AUDIO_FILENAMES).toHaveLength(8);
    expect(SOUND_CATALOG['quest-complete']).toBe(SOUND_CATALOG.achievement);
    expect(SOUND_CATALOG.achievement).toBe(SOUND_CATALOG['level-up']);
    expect(new Set(Object.values(SOUND_CATALOG)).size).toBe(8);
  });
  it('uses the approved gains and clamps master volume',()=>{
    expect(SOUND_GAINS).toEqual({'ui-tap':.45,reveal:.55,correct:.70,incorrect:.45,'overlay-open':.45,'overlay-close':.40,'quest-complete':.80,achievement:.90,'level-up':.95,'reward-reveal':.85});
    expect(effectiveVolume(2,'level-up')).toBe(.95);expect(effectiveVolume(-1,'correct')).toBe(0);expect(effectiveVolume(.65,'correct')).toBeCloseTo(.455);
  });
  it('keeps only essential learning feedback in calm mode',()=>expect([...CALM_ALLOWED]).toEqual(['reveal','correct','incorrect']));
  it('selects one milestone by deterministic priority',()=>{
    expect(selectMilestone({questComplete:true})).toBe('quest-complete');
    expect(selectMilestone({achievement:true,questComplete:true})).toBe('achievement');
    expect(selectMilestone({levelUp:true,achievement:true,questComplete:true})).toBe('level-up');
  });
  it('fails silently while locked, disabled, muted, calm-suppressed, or hidden',()=>{
    resetSoundPlayerForTests();expect(canPlaySound('correct',{settings:{enabled:true,volume:.65}})).toBe(false);unlockSound();
    expect(canPlaySound('correct',{settings:{enabled:false,volume:.65}})).toBe(false);
    expect(canPlaySound('correct',{settings:{enabled:true,volume:0}})).toBe(false);
    expect(canPlaySound('achievement',{calm:true,settings:{enabled:true,volume:.65}})).toBe(false);
    expect(canPlaySound('correct',{calm:true,settings:{enabled:true,volume:.65}})).toBe(true);
    expect(canPlaySound('correct',{hidden:true,settings:{enabled:true,volume:.65}})).toBe(false);
  });
});
