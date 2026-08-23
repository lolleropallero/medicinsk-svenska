import music01 from '../../assets/audio/music/music-01.mp3?url';
import music02 from '../../assets/audio/music/music-02.mp3?url';
import music03 from '../../assets/audio/music/music-03.mp3?url';
import music04 from '../../assets/audio/music/music-04.mp3?url';
import music05 from '../../assets/audio/music/music-05.mp3?url';
import type { MusicTrack, MusicTrackId } from './types';

export const MUSIC_TRACK_IDS = ['music-01','music-02','music-03','music-04','music-05'] as const satisfies readonly MusicTrackId[];
export const MUSIC_CATALOG:Record<MusicTrackId,MusicTrack> = {
  'music-01':{id:'music-01',src:music01,normalizationGain:.47,duration:174.6135},
  'music-02':{id:'music-02',src:music02,normalizationGain:.52,duration:179.6135},
  'music-03':{id:'music-03',src:music03,normalizationGain:.58,duration:116.9735},
  'music-04':{id:'music-04',src:music04,normalizationGain:.48,duration:169.7335},
  'music-05':{id:'music-05',src:music05,normalizationGain:.50,duration:153.8935},
};
