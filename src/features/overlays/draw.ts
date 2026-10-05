import {
  FilterMode,
  MipmapMode,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  TextAlign,
  type SkCanvas,
  type SkImage,
  type SkParagraph,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

import { layoutParagraph } from '@/lib/skia';

import {
  arrowHead,
  arrowLine,
  containsPoint,
  isLightColor,
  logoRect,
  shapeRect,
  WATERMARK_OPACITY,
  type Point,
  type Rect,
  type Size,
} from './layout';
import type { LogoSetting, Overlay, ShapeOverlay, TextOverlay } from './types';

export type OverlayAssets = {
  fonts: SkTypefaceFontProvider | null;
  logo: SkImage | null;
};

type TextLayout = {
  paragraph: SkParagraph;
  origin: Point;
  bounds: Rect;
  radius: number;
};

export function layoutTextOverlay(
  overlay: TextOverlay,
  size: Size,
  fonts: SkTypefaceFontProvider | null
): TextLayout {
  const fontSize = overlay.size * Math.min(size.width, size.height);
  const maxWidth = size.width * 0.9;
  const paragraph = layoutParagraph(
    {
      text: overlay.text.trim() || ' ',
      fontSize,
      color: overlay.color,
      bold: overlay.bold,
      align: TextAlign.Center,
      shadow: overlay.style === 'shadow',
    },
    maxWidth,
    fonts
  );
  const textWidth = Math.min(maxWidth, paragraph.getLongestLine());
  const textHeight = paragraph.getHeight();
  const centerX = overlay.x * size.width;
  const centerY = overlay.y * size.height;
  const padX = fontSize * 0.45;
  const padY = fontSize * 0.25;
  return {
    paragraph,
    origin: { x: centerX - maxWidth / 2, y: centerY - textHeight / 2 },
    bounds: {
      x: centerX - textWidth / 2 - padX,
      y: centerY - textHeight / 2 - padY,
      width: textWidth + padX * 2,
      height: textHeight + padY * 2,
    },
    radius: fontSize * 0.3,
  };
}

export function overlayBounds(
  overlay: Overlay,
  size: Size,
  fonts: SkTypefaceFontProvider | null
): Rect {
  return overlay.kind === 'text'
    ? layoutTextOverlay(overlay, size, fonts).bounds
    : shapeRect(overlay, size);
}

function fillPaint(color: string) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  return paint;
}

function strokePaint(color: string, width: number) {
  const paint = fillPaint(color);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(width);
  paint.setStrokeCap(StrokeCap.Round);
  paint.setStrokeJoin(StrokeJoin.Round);
  return paint;
}

function toSkRect(rect: Rect) {
  return Skia.XYWHRect(rect.x, rect.y, rect.width, rect.height);
}

function drawText(
  canvas: SkCanvas,
  overlay: TextOverlay,
  size: Size,
  fonts: SkTypefaceFontProvider | null
) {
  const layout = layoutTextOverlay(overlay, size, fonts);
  if (overlay.style === 'band') {
    // A dark band behind light text and a light band behind dark text keep it readable on any photo.
    const band = isLightColor(overlay.color)
      ? 'rgba(17, 24, 39, 0.72)'
      : 'rgba(255, 255, 255, 0.88)';
    canvas.drawRRect(
      Skia.RRectXY(toSkRect(layout.bounds), layout.radius, layout.radius),
      fillPaint(band)
    );
  }
  layout.paragraph.paint(canvas, layout.origin.x, layout.origin.y);
}

function drawShape(canvas: SkCanvas, shape: ShapeOverlay, size: Size) {
  const rect = shapeRect(shape, size);
  const strokeWidth = Math.max(2, shape.thickness * Math.min(size.width, size.height));
  const paint = strokePaint(shape.color, strokeWidth);
  if (shape.shape === 'rectangle') {
    const radius = strokeWidth * 1.5;
    canvas.drawRRect(Skia.RRectXY(toSkRect(rect), radius, radius), paint);
  } else if (shape.shape === 'circle') {
    canvas.drawOval(toSkRect(rect), paint);
  } else {
    const { from, to } = arrowLine(rect, shape.direction);
    canvas.drawLine(from.x, from.y, to.x, to.y, paint);
    if (shape.shape === 'arrow') {
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const [left, right] = arrowHead(from, to, Math.max(strokeWidth * 3, length * 0.28));
      canvas.drawLine(to.x, to.y, left.x, left.y, paint);
      canvas.drawLine(to.x, to.y, right.x, right.y, paint);
    }
  }
}

export function drawLogo(canvas: SkCanvas, logo: SkImage, setting: LogoSetting, size: Size) {
  const rect = logoRect(setting, size, logo.width() / logo.height());
  const paint = Skia.Paint();
  paint.setAlphaf(setting.style === 'watermark' ? WATERMARK_OPACITY : 1);
  canvas.drawImageRectOptions(
    logo,
    Skia.XYWHRect(0, 0, logo.width(), logo.height()),
    toSkRect(rect),
    FilterMode.Linear,
    MipmapMode.Linear,
    paint
  );
}

// A dashed outline reads as "selected" rather than as part of the picture, and it is never saved.
function drawSelection(canvas: SkCanvas, bounds: Rect, size: Size) {
  const width = Math.max(1.5, Math.min(size.width, size.height) * 0.004);
  const rect = toSkRect(bounds);
  canvas.drawRect(rect, strokePaint('rgba(17, 24, 39, 0.8)', width * 2));
  const dashes = strokePaint('#FFFFFF', width);
  dashes.setStrokeCap(StrokeCap.Butt);
  dashes.setPathEffect(Skia.PathEffect.MakeDash([width * 4, width * 3], 0));
  canvas.drawRect(rect, dashes);
}

// Overlays are drawn in a coordinate space from (0, 0) to the picture size.
export function drawOverlays(
  canvas: SkCanvas,
  overlays: Overlay[],
  logo: LogoSetting,
  size: Size,
  assets: OverlayAssets,
  selectedId: string | null = null
) {
  for (const overlay of overlays) {
    if (overlay.kind === 'text') {
      drawText(canvas, overlay, size, assets.fonts);
    } else {
      drawShape(canvas, overlay, size);
    }
  }
  if (logo.enabled && assets.logo) {
    drawLogo(canvas, assets.logo, logo, size);
  }
  const selected = selectedId ? overlays.find((overlay) => overlay.id === selectedId) : undefined;
  if (selected) {
    drawSelection(canvas, overlayBounds(selected, size, assets.fonts), size);
  }
}

// Topmost overlay first, matching what is drawn last.
export function overlayAt(
  overlays: Overlay[],
  point: Point,
  size: Size,
  fonts: SkTypefaceFontProvider | null
): Overlay | undefined {
  const slop = Math.min(size.width, size.height) * 0.03;
  for (let index = overlays.length - 1; index >= 0; index -= 1) {
    if (containsPoint(overlayBounds(overlays[index], size, fonts), point, slop)) {
      return overlays[index];
    }
  }
  return undefined;
}
