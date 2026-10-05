import {
  clampCrop,
  cropWindow,
  fitRect,
  orientedSize,
  pixelAlignedWindow,
  rotateClockwise,
  rotateCounterClockwise,
} from '@/features/image-editor/geometry';
import { OUTPUT_PRESETS, outputSize } from '@/features/image-editor/presets';
import type { CropState } from '@/features/image-editor/types';

const crop = (patch: Partial<CropState> = {}): CropState => ({
  rotation: 0,
  flipX: false,
  shape: 'original',
  zoom: 1,
  panX: 0,
  panY: 0,
  ...patch,
});

describe('image crop geometry', () => {
  it('swaps width and height for quarter turns', () => {
    expect(orientedSize({ width: 4000, height: 3000 }, 90)).toEqual({ width: 3000, height: 4000 });
    expect(orientedSize({ width: 4000, height: 3000 }, 180)).toEqual({ width: 4000, height: 3000 });
  });

  it('turns in both directions and wraps around', () => {
    expect(rotateClockwise(270)).toBe(0);
    expect(rotateCounterClockwise(0)).toBe(270);
  });

  it('keeps the whole photo for the original shape', () => {
    expect(cropWindow({ width: 4000, height: 3000 }, crop())).toMatchObject({
      x: 0,
      y: 0,
      width: 4000,
      height: 3000,
    });
  });

  it('centres the largest square on a landscape photo', () => {
    expect(cropWindow({ width: 4000, height: 3000 }, crop({ shape: 'square' }))).toMatchObject({
      x: 500,
      y: 0,
      width: 3000,
      height: 3000,
      maxPanX: 500,
      maxPanY: 0,
    });
  });

  it('keeps panning inside the photo', () => {
    const window = cropWindow(
      { width: 4000, height: 3000 },
      crop({ shape: 'square', panX: 9999, panY: -50 })
    );
    expect(window.x).toBe(1000);
    expect(window.y).toBe(0);
  });

  it('zooms in by shrinking the crop and limits the zoom', () => {
    const zoomed = cropWindow({ width: 4000, height: 3000 }, crop({ zoom: 2 }));
    expect(zoomed).toMatchObject({ width: 2000, height: 1500, x: 1000, y: 750 });
    expect(cropWindow({ width: 4000, height: 3000 }, crop({ zoom: 50 })).zoom).toBe(5);
    expect(cropWindow({ width: 4000, height: 3000 }, crop({ zoom: 0.2 })).zoom).toBe(1);
  });

  it('puts a full-size crop on whole pixels inside the photo', () => {
    const photo = { width: 4032, height: 3024 };
    // A 4:5 crop of a 3024-pixel-tall photo is 2419.2 pixels wide.
    const window = cropWindow(photo, crop({ shape: 'portrait' }));
    expect(pixelAlignedWindow(window, { width: 2419, height: 3024 }, photo)).toEqual({
      x: 806,
      y: 0,
      width: 2419,
      height: 3024,
    });
    const atEdge = { x: 1612.6, y: 0.4, width: 2419.4, height: 3023.6 };
    expect(pixelAlignedWindow(atEdge, { width: 2419, height: 3024 }, photo)).toEqual({
      x: 1613,
      y: 0,
      width: 2419,
      height: 3024,
    });
  });

  it('measures crops on the turned photo', () => {
    const window = cropWindow(
      { width: 4000, height: 3000 },
      crop({ rotation: 90, shape: 'landscape' })
    );
    expect(window.width).toBe(3000);
    expect(window.height).toBeCloseTo(1687.5);
  });

  it('stores clamped values', () => {
    const clamped = clampCrop(
      { width: 4000, height: 3000 },
      crop({ shape: 'square', panX: 800, zoom: 9 })
    );
    expect(clamped.zoom).toBe(5);
    expect(clamped.panX).toBe(800);
    expect(
      clampCrop({ width: 4000, height: 3000 }, crop({ shape: 'square', panX: 800 })).panX
    ).toBe(500);
  });

  it('fits a frame of a given shape inside a container', () => {
    expect(fitRect({ width: 400, height: 800 }, 1, 20)).toEqual({
      x: 20,
      y: 220,
      width: 360,
      height: 360,
    });
    expect(fitRect({ width: 400, height: 300 }, 16 / 9)).toEqual({
      x: 0,
      y: 37.5,
      width: 400,
      height: 225,
    });
  });
});

describe('photo output sizes', () => {
  it('keeps every pixel of the crop at the original size', () => {
    expect(outputSize(OUTPUT_PRESETS.original, 4000, 3000)).toEqual({ width: 4000, height: 3000 });
    expect(outputSize(OUTPUT_PRESETS.original, 2999.6, 1687.4)).toEqual({
      width: 3000,
      height: 1687,
    });
  });

  it('saves at high JPEG quality', () => {
    expect(OUTPUT_PRESETS.original.jpegQuality).toBeGreaterThanOrEqual(95);
  });

  it('uses the exact size for the YouTube thumbnail', () => {
    expect(outputSize(OUTPUT_PRESETS['yt-thumbnail'], 3000, 1687)).toEqual({
      width: 1280,
      height: 720,
    });
    expect(OUTPUT_PRESETS['yt-thumbnail'].shape).toBe('landscape');
  });
});
