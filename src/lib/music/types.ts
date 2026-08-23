export type MusicTrackId = 'music-01' | 'music-02' | 'music-03' | 'music-04' | 'music-05';

export interface MusicTrack {
  id: MusicTrackId;
  src: string;
  normalizationGain: number;
  duration: number;
}

export interface MusicSettings { enabled: boolean; volume: number }

export interface MusicSession {
  schemaVersion: 1;
  bag: MusicTrackId[];
  position: number;
  currentTrack: MusicTrackId;
  currentTime: number;
  previousTrack?: MusicTrackId;
  failed: MusicTrackId[];
}
