import { Directory, File, Paths } from 'expo-file-system';

export type OutputExtension = 'jpg' | 'png' | 'mp4';

function timestamp(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

// The file name becomes the item's name in the gallery, so it starts with the school's name.
export function outputName(extension: OutputExtension): string {
  const suffix = Math.random().toString(36).slice(2, 6);
  return `walnut-academy-${timestamp(new Date())}-${suffix}.${extension}`;
}

export function outputFile(folder: string, extension: OutputExtension): File {
  const directory = new Directory(Paths.cache, folder);
  directory.create({ intermediates: true, idempotent: true });
  return new File(directory, outputName(extension));
}

// Cache folders holding working copies: the picker's copies of chosen photos and videos, decoded
// photos, video frames, music, and files the app makes before they are copied to the album.
const TEMPORARY_FOLDERS = [
  'ImagePicker',
  'ImageManipulator',
  'VideoThumbnails',
  'DocumentPicker',
  'edited-photos',
  'notice-cards',
  'video-layers',
  'rendered-videos',
  'video-frames',
];

const DAY_MS = 24 * 60 * 60 * 1000;

function isInCache(uri: string): boolean {
  const cache = Paths.cache.uri.endsWith('/') ? Paths.cache.uri : `${Paths.cache.uri}/`;
  return uri.startsWith(cache);
}

// Removes a working copy once nothing needs it. Gallery items and the app's own files are never
// touched, because only files inside the cache are removed.
export function deleteTemporaryFile(uri: string | null | undefined): void {
  if (!uri || !isInCache(uri)) {
    return;
  }
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Already gone; anything left over is removed at the next start.
  }
}

// Clears working copies left from earlier sessions, for example when the app closed mid-edit.
// Files younger than a day stay, so an app that was handed one can finish reading it.
export function removeOldTemporaryFiles(maxAgeMs = DAY_MS): void {
  const cutoff = Date.now() - maxAgeMs;
  for (const name of TEMPORARY_FOLDERS) {
    try {
      const folder = new Directory(Paths.cache, name);
      if (!folder.exists) {
        continue;
      }
      for (const entry of folder.list()) {
        if (entry instanceof File && (entry.lastModified ?? 0) < cutoff) {
          entry.delete();
        }
      }
    } catch {
      // A folder that can't be read is tried again at the next start.
    }
  }
}

export function writeBytes(file: File, bytes: Uint8Array): string {
  file.create({ overwrite: true });
  file.write(bytes);
  return file.uri;
}

export function persistentFile(folder: string, name: string): File {
  const directory = new Directory(Paths.document, folder);
  directory.create({ intermediates: true, idempotent: true });
  return new File(directory, name);
}
