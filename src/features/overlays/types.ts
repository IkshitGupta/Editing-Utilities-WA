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

export type ShapeKind = 'rectangle' | 'circle' | 'arrow';
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
  direction: ArrowDirection;
};

export type Overlay = TextOverlay | ShapeOverlay;

export type LogoCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type LogoSize = 'small' | 'medium' | 'large';

export type LogoSetting = {
  enabled: boolean;
  corner: LogoCorner;
  size: LogoSize;
};

// Captions start near the bottom, so the logo starts at the top to keep the two apart.
export const DEFAULT_LOGO: LogoSetting = { enabled: false, corner: 'top-right', size: 'medium' };

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
    style: 'band',
    bold: true,
    ...partial,
  };
}

export function newShapeOverlay(shape: ShapeKind): ShapeOverlay {
  const isArrow = shape === 'arrow';
  return {
    id: newId(),
    kind: 'shape',
    shape,
    x: 0.5,
    y: 0.5,
    width: isArrow ? 0.32 : 0.35,
    height: isArrow ? 0.12 : 0.35,
    color: brand.yellow,
    thickness: 0.012,
    direction: 'right',
  };
}
