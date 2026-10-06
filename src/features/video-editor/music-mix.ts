import { clamp } from '@/lib/utils';

import type { VideoClip, VideoEdit } from './edit-list';

// How the music and the video's own sound are mixed. The preview follows the same rules as the
// saved video, so what plays while editing is what gets saved.

// The video's own sound is lowered under music so speech does not fight it.
export const ORIGINAL_VOLUME_UNDER_MUSIC = 0.35;

const FADE_OUT_MS = 2000;

// Music fades out over the last 2 seconds, or over the last quarter of a very short video.
export function musicFadeOutMs(videoMs: number): number {
  return clamp(videoMs / 4, 0, FADE_OUT_MS);
}

// An equal-power curve, the one the saved video uses, so the sound dies away evenly.
export function fadeOutGain(positionMs: number, videoMs: number): number {
  const fadeMs = musicFadeOutMs(videoMs);
  const fadeStartMs = videoMs - fadeMs;
  if (fadeMs <= 0 || positionMs <= fadeStartMs) {
    return 1;
  }
  if (positionMs >= videoMs) {
    return 0;
  }
  return Math.cos(((positionMs - fadeStartMs) / fadeMs) * (Math.PI / 2));
}

// Clips are joined in order, so a moment in one clip comes after the kept parts of earlier clips.
export function savedVideoPositionMs(
  clips: readonly VideoClip[],
  clipId: string,
  clipPositionMs: number
): number {
  let offsetMs = 0;
  for (const clip of clips) {
    const keptMs = Math.max(0, clip.endMs - clip.startMs);
    if (clip.id === clipId) {
      return offsetMs + clamp(clipPositionMs - clip.startMs, 0, keptMs);
    }
    offsetMs += keptMs;
  }
  return 0;
}

// The music starts with the video and repeats until the video ends.
export function loopPositionMs(videoPositionMs: number, musicMs: number): number {
  if (musicMs <= 0) {
    return Math.max(0, videoPositionMs);
  }
  return ((videoPositionMs % musicMs) + musicMs) % musicMs;
}

// How far the music is from where it should be, measured the short way round the loop.
export function loopDriftMs(actualMs: number, expectedMs: number, musicMs: number): number {
  if (musicMs <= 0) {
    return actualMs - expectedMs;
  }
  const ahead = loopPositionMs(actualMs - expectedMs, musicMs);
  return ahead > musicMs / 2 ? ahead - musicMs : ahead;
}

export type SoundLevels = {
  music: number;
  // 0 when the video's own sound is left out.
  original: number;
};

export function soundLevels(
  edit: Pick<VideoEdit, 'sound' | 'musicVolume' | 'mixOriginal'>,
  hasMusic: boolean,
  videoPositionMs: number,
  videoMs: number
): SoundLevels {
  if (edit.sound === 'mute') {
    return { music: 0, original: 0 };
  }
  if (edit.sound !== 'music' || !hasMusic) {
    return { music: 0, original: 1 };
  }
  const fade = fadeOutGain(videoPositionMs, videoMs);
  return {
    music: edit.musicVolume * fade,
    original: edit.mixOriginal ? ORIGINAL_VOLUME_UNDER_MUSIC * fade : 0,
  };
}
