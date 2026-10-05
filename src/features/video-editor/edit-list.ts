import { z } from 'zod';

import { orientedSize } from '@/features/image-editor/geometry';
import type { Rotation } from '@/features/image-editor/types';
import type { LogoSetting, TextOverlay } from '@/features/overlays/types';
import { clamp } from '@/lib/utils';

import {
  MAX_VIDEO_BITRATE,
  VIDEO_SHAPES,
  cropForAspect,
  isFullFrame,
  outputVideoSize,
  videoBitrate,
  type VideoShapeId,
} from './presets';

export type VideoClip = {
  id: string;
  uri: string;
  // Displayed size, after the rotation stored in the file.
  width: number;
  height: number;
  durationMs: number;
  hasAudio: boolean;
  // Bits per second for the whole file, or 0 when the file doesn't say.
  bitrate: number;
  // The video track's format, such as video/avc or video/hevc, or '' when unknown.
  codec: string;
  startMs: number;
  endMs: number;
};

export type SoundMode = 'original' | 'mute' | 'music';

export type VideoEdit = {
  clips: VideoClip[];
  rotation: Rotation;
  shape: VideoShapeId;
  // Slides the crop from one side (-1) through the centre (0) to the other (1).
  position: number;
  sound: SoundMode;
  music: { uri: string; name: string } | null;
  musicVolume: number;
  // Whether the video's own sound plays under the music.
  mixOriginal: boolean;
  logo: LogoSetting;
  caption: TextOverlay | null;
};

// The video's own sound is lowered so speech does not fight the music.
const ORIGINAL_VOLUME_UNDER_MUSIC = 0.35;

const unit = z.number().min(0).max(1);

const cropSchema = z
  .object({ left: unit, top: unit, right: unit, bottom: unit })
  .refine((crop) => crop.right > crop.left && crop.bottom > crop.top, 'The crop area is empty.');

const clipSchema = z
  .object({
    uri: z.string().min(1),
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0),
    crop: cropSchema.nullable(),
  })
  .refine(
    (clip) => clip.endMs - clip.startMs >= 500,
    'Each clip must be at least half a second long.'
  );

const evenSide = z
  .number()
  .int()
  .min(2)
  .max(3840)
  .refine((value) => value % 2 === 0, 'This video size is not supported.');

export const renderSpecSchema = z.object({
  clips: z
    .array(clipSchema)
    .min(1, 'Add at least one video.')
    .max(20, 'Join up to 20 clips at a time.'),
  rotationDegrees: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  width: evenSide,
  height: evenSide,
  videoBitrate: z.number().int().min(100_000).max(MAX_VIDEO_BITRATE),
  keepOriginalAudio: z.boolean(),
  originalVolume: unit,
  musicUri: z.string().min(1).nullable(),
  musicVolume: unit,
  overlayUri: z.string().min(1).nullable(),
  fileName: z
    .string()
    .regex(/^[A-Za-z0-9_-]+\.mp4$/)
    .optional(),
});

export type RenderSpecInput = z.infer<typeof renderSpecSchema>;

// The shortest part of a clip the trim handles allow.
export const MIN_CLIP_MS = 1000;

// Values stay fractional so slow drags add up; the render spec rounds them.
export function trimClip(clip: VideoClip, handle: 'start' | 'end', deltaMs: number): VideoClip {
  const minLength = Math.min(MIN_CLIP_MS, clip.durationMs);
  if (handle === 'start') {
    return { ...clip, startMs: clamp(clip.startMs + deltaMs, 0, clip.endMs - minLength) };
  }
  return { ...clip, endMs: clamp(clip.endMs + deltaMs, clip.startMs + minLength, clip.durationMs) };
}

export function trimmedDurationMs(clips: VideoClip[]): number {
  return clips.reduce((total, clip) => total + Math.max(0, clip.endMs - clip.startMs), 0);
}

// Every clip is cropped to the first clip's shape (or the chosen shape) so joined clips match.
export function outputAspect(edit: VideoEdit): number {
  const chosen = VIDEO_SHAPES[edit.shape].aspect;
  if (chosen) {
    return chosen;
  }
  const first = orientedSize(edit.clips[0], edit.rotation);
  return first.width / first.height;
}

export function clipCrop(clip: VideoClip, edit: VideoEdit) {
  return cropForAspect(orientedSize(clip, edit.rotation), outputAspect(edit), edit.position);
}

// The sharpest clip sets the size, so joining a clip never lowers another clip's resolution.
export function outputSizeFor(edit: VideoEdit) {
  const shortSides = edit.clips.map((clip) => {
    const rotated = orientedSize(clip, edit.rotation);
    const crop = clipCrop(clip, edit);
    return Math.min(
      (crop.right - crop.left) * rotated.width,
      (crop.bottom - crop.top) * rotated.height
    );
  });
  return outputVideoSize(outputAspect(edit), Math.max(...shortSides));
}

export function buildRenderSpec(edit: VideoEdit, overlayUri: string | null): RenderSpecInput {
  const size = outputSizeFor(edit);
  const bitrate = videoBitrate(size, edit.clips);
  const musicUri = edit.sound === 'music' && edit.music ? edit.music.uri : null;
  const keepOriginalAudio =
    edit.sound === 'original' || (edit.sound === 'music' && (edit.mixOriginal || !musicUri));
  return {
    clips: edit.clips.map((clip) => {
      const crop = clipCrop(clip, edit);
      return {
        uri: clip.uri,
        startMs: Math.round(clip.startMs),
        endMs: Math.round(clip.endMs),
        crop: isFullFrame(crop) ? null : crop,
      };
    }),
    rotationDegrees: edit.rotation,
    width: size.width,
    height: size.height,
    videoBitrate: bitrate,
    keepOriginalAudio,
    originalVolume: musicUri ? ORIGINAL_VOLUME_UNDER_MUSIC : 1,
    musicUri,
    musicVolume: edit.musicVolume,
    overlayUri,
  };
}
