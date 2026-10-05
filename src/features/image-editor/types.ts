import type { LogoSetting, Overlay } from '@/features/overlays/types';

// Clockwise quarter turns.
export type Rotation = 0 | 90 | 180 | 270;

export type CropShapeId = 'original' | 'square' | 'portrait' | 'landscape' | 'tall';

export type OutputPresetId = 'original' | 'yt-thumbnail';

export type CropState = {
  rotation: Rotation;
  flipX: boolean;
  shape: CropShapeId;
  // 1 shows the largest crop of the chosen shape; higher values zoom in.
  zoom: number;
  // Offset of the crop's centre from the picture's centre, in pixels of the rotated picture.
  panX: number;
  panY: number;
};

export type ImageEdit = CropState & {
  overlays: Overlay[];
  logo: LogoSetting;
  output: OutputPresetId;
};
