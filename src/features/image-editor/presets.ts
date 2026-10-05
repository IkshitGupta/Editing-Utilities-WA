import type { CropShapeId, OutputPresetId } from './types';

export type CropShape = {
  id: CropShapeId;
  label: string;
  // Width divided by height; null keeps the picture's own shape.
  aspect: number | null;
};

export const CROP_SHAPES: readonly CropShape[] = [
  { id: 'original', label: 'Original', aspect: null },
  { id: 'square', label: 'Square', aspect: 1 },
  { id: 'portrait', label: 'Portrait 4:5', aspect: 4 / 5 },
  { id: 'landscape', label: 'Wide 16:9', aspect: 16 / 9 },
  { id: 'tall', label: 'Tall 9:16', aspect: 9 / 16 },
];

export type OutputPreset = {
  id: OutputPresetId;
  label: string;
  hint: string;
  // Presets with a fixed size also fix the crop shape.
  shape?: CropShapeId;
  width?: number;
  height?: number;
  jpegQuality: number;
};

// Pictures keep the cropped photo's own pixels, so editing never makes them less sharp.
// WhatsApp, Facebook and YouTube shrink pictures themselves when they need to.
export const OUTPUT_PRESETS: Record<OutputPresetId, OutputPreset> = {
  original: {
    id: 'original',
    label: 'Original size',
    hint: 'Full resolution, up to 4096 pixels',
    jpegQuality: 95,
  },
  'yt-thumbnail': {
    id: 'yt-thumbnail',
    label: 'YouTube thumbnail',
    hint: '1280 × 720 pixels',
    shape: 'landscape',
    width: 1280,
    height: 720,
    jpegQuality: 95,
  },
};

export const OUTPUT_PRESET_ORDER: readonly OutputPresetId[] = ['original', 'yt-thumbnail'];

export function cropShape(id: CropShapeId): CropShape {
  return CROP_SHAPES.find((shape) => shape.id === id) ?? CROP_SHAPES[0];
}

export function outputSize(
  preset: OutputPreset,
  cropWidth: number,
  cropHeight: number
): { width: number; height: number } {
  if (preset.width && preset.height) {
    return { width: preset.width, height: preset.height };
  }
  return {
    width: Math.max(1, Math.round(cropWidth)),
    height: Math.max(1, Math.round(cropHeight)),
  };
}
