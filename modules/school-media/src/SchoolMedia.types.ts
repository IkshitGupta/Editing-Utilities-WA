export type VideoInfo = {
  // Size as the video is displayed, after any rotation stored in the file.
  width: number;
  height: number;
  durationMs: number;
  hasAudio: boolean;
  // Bits per second for the whole file, or 0 when the file doesn't say.
  bitrate: number;
};

// Fractions of the (already rotated) frame, measured from the top-left corner.
export type CropRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type ClipSpec = {
  uri: string;
  startMs: number;
  endMs: number;
  crop?: CropRect | null;
};

export type RenderSpec = {
  clips: ClipSpec[];
  // Clockwise, in quarter turns.
  rotationDegrees: number;
  width: number;
  height: number;
  videoBitrate: number;
  keepOriginalAudio: boolean;
  originalVolume: number;
  musicUri?: string | null;
  musicVolume: number;
  // A transparent PNG at the output size holding the logo and text.
  overlayUri?: string | null;
};

export type RenderResult = {
  uri: string;
  sizeBytes: number;
  durationMs: number;
};

export type ShareOutcome = 'app' | 'chooser';

export type RenderProgressEvent = {
  // 0 to 100.
  progress: number;
};

export type SchoolMediaEvents = {
  onRenderProgress: (event: RenderProgressEvent) => void;
};
