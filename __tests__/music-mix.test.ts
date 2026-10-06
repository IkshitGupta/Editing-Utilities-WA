import type { VideoClip } from '@/features/video-editor/edit-list';
import {
  fadeOutGain,
  loopDriftMs,
  loopPositionMs,
  musicFadeOutMs,
  savedVideoPositionMs,
  soundLevels,
} from '@/features/video-editor/music-mix';

const clip = (id: string, startMs: number, endMs: number): VideoClip => ({
  id,
  uri: `content://media/external/video/media/${id}`,
  width: 1920,
  height: 1080,
  durationMs: 60_000,
  hasAudio: true,
  bitrate: 16_000_000,
  codec: 'video/avc',
  startMs,
  endMs,
});

describe('closing fade', () => {
  it('lasts 2 seconds, or a quarter of a very short video', () => {
    expect(musicFadeOutMs(60_000)).toBe(2000);
    expect(musicFadeOutMs(4_000)).toBe(1000);
    expect(musicFadeOutMs(0)).toBe(0);
  });

  it('keeps full volume until the fade, then dies away to silence at the end', () => {
    expect(fadeOutGain(0, 10_000)).toBe(1);
    expect(fadeOutGain(8_000, 10_000)).toBe(1);
    expect(fadeOutGain(9_000, 10_000)).toBeCloseTo(Math.SQRT1_2);
    expect(fadeOutGain(10_000, 10_000)).toBe(0);
    expect(fadeOutGain(12_000, 10_000)).toBe(0);
  });

  it('follows an equal-power curve, which stays louder than a straight line', () => {
    expect(fadeOutGain(8_500, 10_000)).toBeCloseTo(Math.cos(Math.PI / 8));
    expect(fadeOutGain(8_500, 10_000)).toBeGreaterThan(0.75);
  });
});

describe('music timing', () => {
  const clips = [clip('a', 5_000, 15_000), clip('b', 0, 2_000)];

  it('places a moment of a clip after the kept parts of earlier clips', () => {
    expect(savedVideoPositionMs(clips, 'a', 10_000)).toBe(5_000);
    expect(savedVideoPositionMs(clips, 'b', 1_000)).toBe(11_000);
  });

  it('keeps positions outside the trim inside the clip', () => {
    expect(savedVideoPositionMs(clips, 'a', 2_000)).toBe(0);
    expect(savedVideoPositionMs(clips, 'a', 30_000)).toBe(10_000);
    expect(savedVideoPositionMs(clips, 'b', 5_000)).toBe(12_000);
  });

  it('repeats the music from its start', () => {
    expect(loopPositionMs(130_000, 123_000)).toBe(7_000);
    expect(loopPositionMs(5_000, 123_000)).toBe(5_000);
    expect(loopPositionMs(5_000, 0)).toBe(5_000);
  });

  it('measures drift the short way round the loop', () => {
    expect(loopDriftMs(1_000, 900, 123_000)).toBe(100);
    expect(loopDriftMs(500, 122_800, 123_000)).toBe(700);
    expect(loopDriftMs(122_800, 500, 123_000)).toBe(-700);
  });
});

describe('sound levels', () => {
  const settings = { musicVolume: 0.6, mixOriginal: false };

  it('plays the original sound unless it is muted or replaced', () => {
    expect(soundLevels({ ...settings, sound: 'original' }, true, 0, 10_000)).toEqual({
      music: 0,
      original: 1,
    });
    expect(soundLevels({ ...settings, sound: 'mute' }, true, 0, 10_000)).toEqual({
      music: 0,
      original: 0,
    });
    expect(soundLevels({ ...settings, sound: 'music' }, false, 0, 10_000)).toEqual({
      music: 0,
      original: 1,
    });
  });

  it('matches the saved video: music at its volume, original sound lowered or left out', () => {
    expect(soundLevels({ ...settings, sound: 'music' }, true, 0, 10_000)).toEqual({
      music: 0.6,
      original: 0,
    });
    const mixed = soundLevels({ ...settings, sound: 'music', mixOriginal: true }, true, 0, 10_000);
    expect(mixed.music).toBeCloseTo(0.6);
    expect(mixed.original).toBeCloseTo(0.35);
  });

  it('fades both sounds together at the end', () => {
    const levels = soundLevels(
      { ...settings, sound: 'music', mixOriginal: true },
      true,
      9_000,
      10_000
    );
    expect(levels.music).toBeCloseTo(0.6 * Math.SQRT1_2);
    expect(levels.original).toBeCloseTo(0.35 * Math.SQRT1_2);
  });
});
