import { clamp } from '@/lib/utils';

import {
  SHAPE_SIZE_MIN,
  TEXT_SIZE_MAX,
  TEXT_SIZE_MIN,
  type ArrowDirection,
  type LogoSetting,
  type LogoSize,
  type LogoStyle,
  type Overlay,
  type ShapeOverlay,
} from './types';

export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type Point = { x: number; y: number };

// A drag or pinch step: movement as fractions of the picture and a scale factor.
export type OverlayChange = { dx: number; dy: number; scale: number };

export function applyOverlayChange(overlay: Overlay, change: OverlayChange): Overlay {
  const moved = {
    ...overlay,
    x: clamp(overlay.x + change.dx, 0, 1),
    y: clamp(overlay.y + change.dy, 0, 1),
  };
  if (change.scale === 1) {
    return moved;
  }
  if (moved.kind === 'text') {
    return { ...moved, size: clamp(moved.size * change.scale, TEXT_SIZE_MIN, TEXT_SIZE_MAX) };
  }
  return {
    ...moved,
    width: clamp(moved.width * change.scale, SHAPE_SIZE_MIN, 1),
    height: clamp(moved.height * change.scale, SHAPE_SIZE_MIN, 1),
  };
}

const LOGO_SIZE: Record<LogoStyle, Record<LogoSize, number>> = {
  solid: { small: 0.14, medium: 0.2, large: 0.28 },
  watermark: { small: 0.3, medium: 0.45, large: 0.6 },
};
const LOGO_MARGIN = 0.035;

// Faint enough to keep the picture clear, strong enough to recognise the logo.
export const WATERMARK_OPACITY = 0.3;

// The logo fits a square box, so tall and wide logos both stay inside the picture.
export function logoRect(setting: LogoSetting, canvas: Size, logoAspect: number): Rect {
  const base = Math.min(canvas.width, canvas.height);
  const box = base * LOGO_SIZE[setting.style][setting.size];
  const aspect = logoAspect > 0 ? logoAspect : 1;
  const width = aspect >= 1 ? box : box * aspect;
  const height = aspect >= 1 ? box / aspect : box;
  if (setting.position === 'center') {
    return { x: (canvas.width - width) / 2, y: (canvas.height - height) / 2, width, height };
  }
  const margin = base * LOGO_MARGIN;
  return {
    x: setting.position.endsWith('left') ? margin : canvas.width - margin - width,
    y: setting.position.startsWith('top') ? margin : canvas.height - margin - height,
    width,
    height,
  };
}

export function shapeRect(shape: ShapeOverlay, canvas: Size): Rect {
  let width = shape.width * canvas.width;
  let height = shape.height * canvas.height;
  // Sizes are fractions of each side, so on a non-square picture a circle uses the shorter one.
  if (shape.shape === 'circle') {
    width = Math.min(width, height);
    height = width;
  }
  return {
    x: shape.x * canvas.width - width / 2,
    y: shape.y * canvas.height - height / 2,
    width,
    height,
  };
}

export function arrowLine(rect: Rect, direction: ArrowDirection): { from: Point; to: Point } {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  switch (direction) {
    case 'right':
      return { from: { x: rect.x, y: centerY }, to: { x: rect.x + rect.width, y: centerY } };
    case 'left':
      return { from: { x: rect.x + rect.width, y: centerY }, to: { x: rect.x, y: centerY } };
    case 'down':
      return { from: { x: centerX, y: rect.y }, to: { x: centerX, y: rect.y + rect.height } };
    case 'up':
      return { from: { x: centerX, y: rect.y + rect.height }, to: { x: centerX, y: rect.y } };
  }
}

// The two short strokes of an arrow head, angled back from the tip.
export function arrowHead(from: Point, to: Point, headLength: number): [Point, Point] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const spread = Math.PI / 7;
  return [
    {
      x: to.x - headLength * Math.cos(angle - spread),
      y: to.y - headLength * Math.sin(angle - spread),
    },
    {
      x: to.x - headLength * Math.cos(angle + spread),
      y: to.y - headLength * Math.sin(angle + spread),
    },
  ];
}

export function containsPoint(rect: Rect, point: Point, slop = 0): boolean {
  return (
    point.x >= rect.x - slop &&
    point.x <= rect.x + rect.width + slop &&
    point.y >= rect.y - slop &&
    point.y <= rect.y + rect.height + slop
  );
}

export function isLightColor(hex: string): boolean {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) {
    return true;
  }
  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}
