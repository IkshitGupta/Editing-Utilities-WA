import {
  ClipOp,
  FilterMode,
  ImageFormat,
  MipmapMode,
  PaintStyle,
  Skia,
  type SkCanvas,
  type SkImage,
} from '@shopify/react-native-skia';

import type { MediaItem } from '@/features/media/types';
import { drawOverlays, type OverlayAssets } from '@/features/overlays/draw';
import { outputFile, writeBytes } from '@/lib/files';
import { renderToBytes } from '@/lib/skia';

import { cropWindow, orientedSize, type Rect } from './geometry';
import { OUTPUT_PRESETS, outputSize } from './presets';
import type { CropState, ImageEdit } from './types';

// Draws the rotated, flipped and cropped photo so the crop fills `frame`. Parts of the photo
// outside the crop are still drawn, which lets the editor show them dimmed around the frame.
export function drawPhoto(canvas: SkCanvas, image: SkImage, crop: CropState, frame: Rect) {
  const source = { width: image.width(), height: image.height() };
  const window = cropWindow(source, crop);
  const oriented = orientedSize(source, crop.rotation);

  canvas.save();
  canvas.translate(frame.x, frame.y);
  canvas.scale(frame.width / window.width, frame.height / window.height);
  canvas.translate(-window.x, -window.y);
  if (crop.flipX) {
    canvas.translate(oriented.width, 0);
    canvas.scale(-1, 1);
  }
  switch (crop.rotation) {
    case 90:
      canvas.translate(source.height, 0);
      canvas.rotate(90, 0, 0);
      break;
    case 180:
      canvas.translate(source.width, source.height);
      canvas.rotate(180, 0, 0);
      break;
    case 270:
      canvas.translate(0, source.width);
      canvas.rotate(270, 0, 0);
      break;
  }
  const bounds = Skia.XYWHRect(0, 0, source.width, source.height);
  canvas.drawImageRectOptions(image, bounds, bounds, FilterMode.Linear, MipmapMode.Linear, null);
  canvas.restore();
}

export function dimOutside(canvas: SkCanvas, frame: Rect) {
  const rect = Skia.XYWHRect(frame.x, frame.y, frame.width, frame.height);
  const shade = Skia.Paint();
  shade.setColor(Skia.Color('rgba(0, 0, 0, 0.6)'));
  canvas.save();
  canvas.clipRect(rect, ClipOp.Difference, true);
  canvas.drawPaint(shade);
  canvas.restore();

  const border = Skia.Paint();
  border.setAntiAlias(true);
  border.setStyle(PaintStyle.Stroke);
  border.setStrokeWidth(2);
  border.setColor(Skia.Color('#FFFFFF'));
  canvas.drawRect(rect, border);
}

export function editedSize(image: SkImage, edit: ImageEdit) {
  const window = cropWindow({ width: image.width(), height: image.height() }, edit);
  return outputSize(OUTPUT_PRESETS[edit.output], window.width, window.height);
}

export async function loadSkImage(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) {
    throw new Error('This photo could not be opened.');
  }
  return image;
}

// Draws the final photo at full output size and saves it as a JPEG, which carries no location data.
export function exportPhoto(image: SkImage, edit: ImageEdit, assets: OverlayAssets): MediaItem {
  const size = editedSize(image, edit);
  const frame = { x: 0, y: 0, width: size.width, height: size.height };
  const bytes = renderToBytes(
    size,
    ImageFormat.JPEG,
    OUTPUT_PRESETS[edit.output].jpegQuality,
    (canvas) => {
      canvas.clear(Skia.Color('#FFFFFF'));
      drawPhoto(canvas, image, edit, frame);
      drawOverlays(canvas, edit.overlays, edit.logo, size, assets);
    }
  );
  const file = outputFile('edited-photos', 'jpg');
  return {
    uri: writeBytes(file, bytes),
    kind: 'image',
    width: size.width,
    height: size.height,
    durationMs: null,
  };
}
