import { clamp } from '@/lib/utils';

import { cropShape } from './presets';
import type { CropState, Rotation } from './types';

export const MAX_ZOOM = 5;

export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };

export function orientedSize(size: Size, rotation: Rotation): Size {
  return rotation === 90 || rotation === 270
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height };
}

export function rotateClockwise(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation;
}

export function rotateCounterClockwise(rotation: Rotation): Rotation {
  return ((rotation + 270) % 360) as Rotation;
}

export type CropWindow = Rect & {
  maxPanX: number;
  maxPanY: number;
  panX: number;
  panY: number;
  zoom: number;
};

// The crop in rotated-picture pixels, with pan and zoom kept inside the picture.
export function cropWindow(source: Size, crop: CropState): CropWindow {
  const oriented = orientedSize(source, crop.rotation);
  const aspect = cropShape(crop.shape).aspect ?? oriented.width / oriented.height;
  let baseWidth: number;
  let baseHeight: number;
  if (oriented.width / oriented.height > aspect) {
    baseHeight = oriented.height;
    baseWidth = oriented.height * aspect;
  } else {
    baseWidth = oriented.width;
    baseHeight = oriented.width / aspect;
  }
  const zoom = clamp(Number.isFinite(crop.zoom) ? crop.zoom : 1, 1, MAX_ZOOM);
  const width = baseWidth / zoom;
  const height = baseHeight / zoom;
  const maxPanX = Math.max(0, (oriented.width - width) / 2);
  const maxPanY = Math.max(0, (oriented.height - height) / 2);
  const panX = clamp(crop.panX, -maxPanX, maxPanX);
  const panY = clamp(crop.panY, -maxPanY, maxPanY);
  return {
    x: oriented.width / 2 + panX - width / 2,
    y: oriented.height / 2 + panY - height / 2,
    width,
    height,
    maxPanX,
    maxPanY,
    panX,
    panY,
    zoom,
  };
}

// Stores the clamped values so the next gesture starts from what is on screen.
export function clampCrop<T extends CropState>(source: Size, crop: T): T {
  const window = cropWindow(source, crop);
  return { ...crop, zoom: window.zoom, panX: window.panX, panY: window.panY };
}

// The crop window moved onto whole pixels at the output size, so each pixel is copied one to one
// instead of being resampled.
export function pixelAlignedWindow(window: Rect, output: Size, bounds: Size): Rect {
  return {
    x: clamp(Math.round(window.x), 0, Math.max(0, bounds.width - output.width)),
    y: clamp(Math.round(window.y), 0, Math.max(0, bounds.height - output.height)),
    width: output.width,
    height: output.height,
  };
}

// The largest rectangle of the given shape centred inside the container.
export function fitRect(container: Size, aspect: number, margin = 0): Rect {
  const availableWidth = Math.max(1, container.width - margin * 2);
  const availableHeight = Math.max(1, container.height - margin * 2);
  let width = availableWidth;
  let height = width / aspect;
  if (height > availableHeight) {
    height = availableHeight;
    width = height * aspect;
  }
  return {
    x: (container.width - width) / 2,
    y: (container.height - height) / 2,
    width,
    height,
  };
}
