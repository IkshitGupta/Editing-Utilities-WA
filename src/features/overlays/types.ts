import { newId } from '@/lib/utils';
import { brand } from '@/theme/colors';

export type TextStyleId = 'plain' | 'shadow' | 'band';

// Positions are the overlay's centre as fractions of the picture; text size is a fraction of
// the picture's shorter side. This keeps overlays in the same place at any output size.
export type TextOverlay = {
  id: string;
  kind: 'text';
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  style: TextStyleId;
  bold: boolean;
};

export type ShapeKind = 'rectangle' | 'circle' | 'arrow' | 'line';
export type ArrowDirection = 'left' | 'right' | 'up' | 'down';

export type ShapeOverlay = {
  id: string;
  kind: 'shape';
  shape: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  thickness: number;
  // A line has no head, so it only uses right (horizontal) and down (vertical).
  direction: ArrowDirection;
};

export type Overlay = TextOverlay | ShapeOverlay;

export type LogoStyle = 'solid' | 'watermark';
export type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
export type LogoSize = 'small' | 'medium' | 'large';

export type LogoSetting = {
  enabled: boolean;
  // A watermark is the logo faded and larger, so the picture stays visible through it.
  style: LogoStyle;
  position: LogoPosition;
  size: LogoSize;
};

// Captions start near the bottom, so the logo starts at the top to keep the two apart.
export const DEFAULT_LOGO: LogoSetting = {
  enabled: false,
  style: 'solid',
  position: 'top-right',
  size: 'medium',
};

// Each look starts in its usual place: a solid logo in a corner, a watermark in the middle.
export function withLogoStyle(logo: LogoSetting, style: LogoStyle): LogoSetting {
  return style === 'watermark'
    ? { ...logo, style, position: 'center', size: 'medium' }
    : { ...logo, style, position: DEFAULT_LOGO.position, size: DEFAULT_LOGO.size };
}

export const OVERLAY_COLORS = [
  '#FFFFFF',
  '#111827',
  brand.yellow,
  brand.magenta,
  brand.blue,
  brand.red,
] as const;

export const TEXT_SIZE_MIN = 0.03;
export const TEXT_SIZE_MAX = 0.2;
export const SHAPE_SIZE_MIN = 0.05;

export function newTextOverlay(
  partial: Partial<Omit<TextOverlay, 'id' | 'kind'>> = {}
): TextOverlay {
  return {
    id: newId(),
    kind: 'text',
    text: 'Your text',
    x: 0.5,
    y: 0.85,
    size: 0.07,
    color: '#FFFFFF',
    style: 'shadow',
    bold: true,
    ...partial,
  };
}

// Arrows and lines get a low box, which keeps them easy to tap without covering the picture.
const SHAPE_SIZE: Record<ShapeKind, { width: number; height: number }> = {
  rectangle: { width: 0.35, height: 0.35 },
  circle: { width: 0.35, height: 0.35 },
  arrow: { width: 0.32, height: 0.12 },
  line: { width: 0.4, height: 0.08 },
};

export function newShapeOverlay(shape: ShapeKind): ShapeOverlay {
  return {
    id: newId(),
    kind: 'shape',
    shape,
    x: 0.5,
    y: 0.5,
    ...SHAPE_SIZE[shape],
    color: brand.yellow,
    thickness: 0.012,
    direction: 'right',
  };
}
