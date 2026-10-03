import type { CropRect } from '@modules/school-media';

import { clamp } from '@/lib/utils';

export type Size = { width: number; height: number };

export type VideoShapeId = 'original' | 'landscape' | 'tall' | 'square';

export const VIDEO_SHAPES: Record<VideoShapeId, { label: string; aspect: number | null }> = {
  original: { label: 'Original', aspect: null },
  landscape: { label: 'Wide 16:9', aspect: 16 / 9 },
  tall: { label: 'Tall 9:16', aspect: 9 / 16 },
  square: { label: 'Square', aspect: 1 },
};

export type VideoPresetId = 'whatsapp' | 'youtube' | 'shorts' | 'facebook';

export type VideoPreset = {
  id: VideoPresetId;
  label: string;
  hint: string;
  shortSide: number;
  bitrate: number;
  shape?: VideoShapeId;
  // Lower the quality of long videos so the file stays near this size.
  targetBytes?: number;
};

export const VIDEO_PRESETS: Record<VideoPresetId, VideoPreset> = {
  whatsapp: {
    id: 'whatsapp',
    label: 'WhatsApp',
    hint: 'Small file, quick to send (720p)',
    shortSide: 720,
    bitrate: 2_500_000,
    targetBytes: 16 * 1024 * 1024,
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    hint: 'Full HD (1080p)',
    shortSide: 1080,
    bitrate: 8_000_000,
  },
  shorts: {
    id: 'shorts',
    label: 'Shorts / Reels',
    hint: 'Tall 9:16 for phones',
    shortSide: 1080,
    bitrate: 8_000_000,
    shape: 'tall',
  },
  facebook: {
    id: 'facebook',
    label: 'Facebook',
    hint: 'Full HD, smaller file',
    shortSide: 1080,
    bitrate: 6_000_000,
  },
};

export const VIDEO_PRESET_ORDER: readonly VideoPresetId[] = [
  'whatsapp',
  'youtube',
  'shorts',
  'facebook',
];

export const AUDIO_BITRATE = 128_000;
export const MIN_VIDEO_BITRATE = 600_000;
const MAX_LONG_SIDE = 1920;
// Leaves room for the MP4 container and audio peaks.
const SIZE_SAFETY = 0.92;

function even(value: number) {
  return Math.max(2, Math.round(value / 2) * 2);
}

// Never enlarges the video; video encoders need even dimensions.
export function outputVideoSize(
  aspect: number,
  preset: VideoPreset,
  sourceShortSide: number
): Size {
  const shortSide = Math.min(preset.shortSide, Math.max(2, sourceShortSide));
  let width = aspect >= 1 ? shortSide * aspect : shortSide;
  let height = aspect >= 1 ? shortSide : shortSide / aspect;
  const longSide = Math.max(width, height);
  if (longSide > MAX_LONG_SIDE) {
    width *= MAX_LONG_SIDE / longSide;
    height *= MAX_LONG_SIDE / longSide;
  }
  return { width: even(width), height: even(height) };
}

export function videoBitrate(
  preset: VideoPreset,
  durationMs: number
): { bitrate: number; tooLong: boolean } {
  if (!preset.targetBytes) {
    return { bitrate: preset.bitrate, tooLong: false };
  }
  const seconds = Math.max(1, durationMs / 1000);
  const budget = (preset.targetBytes * 8 * SIZE_SAFETY) / seconds - AUDIO_BITRATE;
  if (budget < MIN_VIDEO_BITRATE) {
    return { bitrate: MIN_VIDEO_BITRATE, tooLong: true };
  }
  return { bitrate: Math.round(Math.min(preset.bitrate, budget)), tooLong: false };
}

// The longest video that still fits the preset's target size at the lowest quality.
export function longestFittingSeconds(preset: VideoPreset): number | null {
  if (!preset.targetBytes) {
    return null;
  }
  return Math.floor((preset.targetBytes * 8 * SIZE_SAFETY) / (MIN_VIDEO_BITRATE + AUDIO_BITRATE));
}

export function estimatedBytes(videoBitrateValue: number, durationMs: number): number {
  return ((videoBitrateValue + AUDIO_BITRATE) * (durationMs / 1000)) / 8;
}

export const FULL_FRAME: CropRect = { left: 0, top: 0, right: 1, bottom: 1 };

// The crop of the given shape, slid between its two extremes by `position` (-1 to 1).
export function cropForAspect(source: Size, aspect: number | null, position: number): CropRect {
  if (!aspect || source.width <= 0 || source.height <= 0) {
    return FULL_FRAME;
  }
  const along = (clamp(position, -1, 1) + 1) / 2;
  const sourceAspect = source.width / source.height;
  if (Math.abs(sourceAspect - aspect) < 0.005) {
    return FULL_FRAME;
  }
  if (sourceAspect > aspect) {
    const width = aspect / sourceAspect;
    const left = (1 - width) * along;
    return { left, top: 0, right: left + width, bottom: 1 };
  }
  const height = sourceAspect / aspect;
  const top = (1 - height) * along;
  return { left: 0, top, right: 1, bottom: top + height };
}

export function isFullFrame(crop: CropRect): boolean {
  return crop.left <= 0 && crop.top <= 0 && crop.right >= 1 && crop.bottom >= 1;
}
