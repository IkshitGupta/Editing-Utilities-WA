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
  longSide?: number;
  jpegQuality: number;
};

export const OUTPUT_PRESETS: Record<OutputPresetId, OutputPreset> = {
  whatsapp: {
    id: 'whatsapp',
    label: 'WhatsApp',
    hint: 'Sharp and quick to send',
    longSide: 1600,
    jpegQuality: 85,
  },
  'fb-square': {
    id: 'fb-square',
    label: 'Facebook square',
    hint: '1080 × 1080',
    shape: 'square',
    width: 1080,
    height: 1080,
    jpegQuality: 90,
  },
  'fb-portrait': {
    id: 'fb-portrait',
    label: 'Facebook portrait',
    hint: '1080 × 1350',
    shape: 'portrait',
    width: 1080,
    height: 1350,
    jpegQuality: 90,
  },
  'yt-thumbnail': {
    id: 'yt-thumbnail',
    label: 'YouTube thumbnail',
    hint: '1280 × 720',
    shape: 'landscape',
    width: 1280,
    height: 720,
    jpegQuality: 90,
  },
  full: {
    id: 'full',
    label: 'Full size',
    hint: 'Largest file, best for printing',
    longSide: 3000,
    jpegQuality: 92,
  },
};

export const OUTPUT_PRESET_ORDER: readonly OutputPresetId[] = [
  'whatsapp',
  'fb-square',
  'fb-portrait',
  'yt-thumbnail',
  'full',
];

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
  const longest = Math.max(cropWidth, cropHeight);
  const scale = preset.longSide ? Math.min(1, preset.longSide / longest) : 1;
  return {
    width: Math.max(1, Math.round(cropWidth * scale)),
    height: Math.max(1, Math.round(cropHeight * scale)),
  };
}
