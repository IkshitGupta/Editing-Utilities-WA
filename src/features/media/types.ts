export type MediaKind = 'image' | 'video';

export type MediaItem = {
  // A content:// URI for gallery items, or a file:// URI for files the app has just made.
  uri: string;
  kind: MediaKind;
  width: number;
  height: number;
  durationMs: number | null;
};
