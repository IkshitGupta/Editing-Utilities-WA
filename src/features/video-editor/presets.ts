import type { CropRect } from '@modules/school-media';

import { clamp } from '@/lib/utils';

export type Size = { width: number; height: number };

export type VideoShapeId = 'original' | 'landscape' | 'tall' | 'square';

export const VIDEO_SHAPES: Record<VideoShapeId, { label: string; aspect: number | null }> = {
  original: { label: 'Original', aspect: null },
  landscape: { label: 'Wide 16:9', aspect: 16 / 9 },
  tall: { label: 'Tall 9:16 (Shorts, Reels)', aspect: 9 / 16 },
  square: { label: 'Square', aspect: 1 },
};

// Videos keep their own size, up to 4K. A phone that can't encode the size it is given falls
// back to the nearest size it can.
const MAX_LONG_SIDE = 3840;
const MAX_SHORT_SIDE = 2160;

// Bits per second for each pixel of the frame. Phones record 1080p video at about 8, and
// 4K video at about 6. Re-encoding at the source's own rate keeps its detail; the floor stops
// already-compressed videos, such as ones received on WhatsApp, from losing more.
const MIN_BITS_PER_PIXEL = 4;
const UNKNOWN_BITS_PER_PIXEL = 8;
const MIN_VIDEO_BITRATE = 1_000_000;
export const MAX_VIDEO_BITRATE = 100_000_000;

function even(value: number) {
  return Math.max(2, Math.round(value / 2) * 2);
}

// Keeps the source's resolution and never enlarges it; video encoders need even dimensions.
export function outputVideoSize(aspect: number, sourceShortSide: number): Size {
  const shortSide = Math.max(2, sourceShortSide);
  const width = aspect >= 1 ? shortSide * aspect : shortSide;
  const height = aspect >= 1 ? shortSide : shortSide / aspect;
  const scale = Math.min(
    1,
    MAX_LONG_SIDE / Math.max(width, height),
    MAX_SHORT_SIDE / Math.min(width, height)
  );
  return { width: even(width * scale), height: even(height * scale) };
}

export type BitrateSource = { width: number; height: number; bitrate: number };

// Uses the highest bits per pixel among the clips, so the saved video is as detailed as the
// best of them.
export function videoBitrate(size: Size, clips: readonly BitrateSource[]): number {
  const bitsPerPixel = Math.max(
    MIN_BITS_PER_PIXEL,
    ...clips.map((clip) =>
      clip.bitrate > 0 && clip.width > 0 && clip.height > 0
        ? clip.bitrate / (clip.width * clip.height)
        : UNKNOWN_BITS_PER_PIXEL
    )
  );
  return Math.round(
    clamp(bitsPerPixel * size.width * size.height, MIN_VIDEO_BITRATE, MAX_VIDEO_BITRATE)
  );
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
