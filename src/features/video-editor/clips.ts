import { ImageFormat, Skia } from '@shopify/react-native-skia';
import * as VideoThumbnails from 'expo-video-thumbnails';

import SchoolMedia, { type VideoInfo } from '@modules/school-media';

import type { MediaItem } from '@/features/media/types';
import { drawOverlays, type OverlayAssets } from '@/features/overlays/draw';
import { outputFile, writeBytes } from '@/lib/files';
import { renderToBytes } from '@/lib/skia';
import { newId } from '@/lib/utils';

import type { VideoClip, VideoEdit } from './edit-list';
import type { Size } from './presets';

export async function loadClip(item: MediaItem): Promise<VideoClip> {
  let info: VideoInfo | null = null;
  try {
    info = await SchoolMedia.getVideoInfo(item.uri);
  } catch {
    info = null;
  }
  const durationMs = info?.durationMs || item.durationMs || 0;
  return {
    id: newId(),
    uri: item.uri,
    width: info?.width || item.width,
    height: info?.height || item.height,
    durationMs,
    hasAudio: info?.hasAudio ?? true,
    startMs: 0,
    endMs: durationMs,
  };
}

// Frames spread across the clip for the trim bar; a frame that cannot be read is skipped.
export async function clipThumbnails(clip: VideoClip, count = 8): Promise<string[]> {
  const uris: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const time = Math.round((clip.durationMs * (index + 0.5)) / count);
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(clip.uri, { time, quality: 0.3 });
      uris.push(uri);
    } catch {
      // Some frames cannot be decoded; the strip simply shows fewer pictures.
    }
  }
  return uris;
}

export function hasOverlayContent(edit: VideoEdit, assets: OverlayAssets): boolean {
  return Boolean(edit.caption?.text.trim()) || (edit.logo.enabled && assets.logo !== null);
}

// The logo and caption are drawn once into a transparent picture the size of the video,
// which the video editor lays over every frame.
export function renderOverlayLayer(
  edit: VideoEdit,
  size: Size,
  assets: OverlayAssets
): string | null {
  if (!hasOverlayContent(edit, assets)) {
    return null;
  }
  const overlays = edit.caption && edit.caption.text.trim() ? [edit.caption] : [];
  const bytes = renderToBytes(size, ImageFormat.PNG, 100, (canvas) => {
    canvas.clear(Skia.Color('transparent'));
    drawOverlays(canvas, overlays, edit.logo, size, assets);
  });
  return writeBytes(outputFile('video-layers', 'png'), bytes);
}
