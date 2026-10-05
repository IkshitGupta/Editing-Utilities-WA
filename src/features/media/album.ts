import {
  Album,
  Asset,
  AssetField,
  MediaType,
  Query,
  getPermissionsAsync,
  requestPermissionsAsync,
  type PermissionResponse,
} from 'expo-media-library';
import { Platform } from 'react-native';

import SchoolMedia from '@modules/school-media';

import { deleteTemporaryFile } from '@/lib/files';
import { ALBUM_TITLE } from '@/school/defaults';

import type { MediaItem } from './types';

const GRANULAR: ('photo' | 'video')[] = ['photo', 'video'];

export const ALBUM_PAGE_SIZE = 120;

// Android 11 and later let an app save, list and remove its own photos and videos without asking.
// Asking anyway would reopen the "Select photos" dialog each time on Android 14 and later.
const NEEDS_STORAGE_ACCESS = Platform.OS === 'android' && Platform.Version < 30;

// From Android 11, the system asks the person to confirm every deletion itself.
export const SYSTEM_CONFIRMS_DELETE = Platform.OS === 'android' && Platform.Version >= 30;

export async function ensureLibraryAccess(): Promise<boolean> {
  if (!NEEDS_STORAGE_ACCESS) {
    return true;
  }
  const response = await requestPermissionsAsync(false, GRANULAR);
  return response.granted;
}

// Checks without asking, so Android's dialog never appears.
export async function hasLibraryAccess(): Promise<boolean> {
  if (!NEEDS_STORAGE_ACCESS) {
    return true;
  }
  return (await getLibraryAccess()).granted;
}

// After the app is reinstalled, Android no longer counts earlier saves as the app's own, so on
// Android 11 and later they appear only with access to all photos and videos.
export async function hasFullLibraryAccess(): Promise<boolean> {
  if (NEEDS_STORAGE_ACCESS) {
    return true;
  }
  try {
    const response = await getLibraryAccess();
    return response.accessPrivileges === 'all';
  } catch {
    return true;
  }
}

export function getLibraryAccess(): Promise<PermissionResponse> {
  return getPermissionsAsync(false, GRANULAR);
}

export function requestFullLibraryAccess(): Promise<PermissionResponse> {
  return requestPermissionsAsync(false, GRANULAR);
}

let installation: number | undefined;

// Identifies this installation of the app, for answers that a reinstall should ask for again.
export function installationTime(): number {
  installation ??= SchoolMedia.installationTime();
  return installation;
}

async function latestAssetIn(album: Album): Promise<Asset | undefined> {
  const [latest] = await new Query()
    .album(album)
    .orderBy({ key: AssetField.MODIFICATION_TIME, ascending: false })
    .limit(1)
    .exe();
  return latest;
}

// Copies a file the app made into the "School Admin" album and returns the gallery copy, whose
// content:// URI other apps can open. The app's own working copy is removed afterwards; callers
// make a new one if they try again.
export async function saveToAlbum(item: MediaItem): Promise<MediaItem> {
  try {
    if (!(await ensureLibraryAccess())) {
      throw new Error(
        'Allow access to photos and videos so the app can save to the School Admin album.'
      );
    }
    const album = await Album.get(ALBUM_TITLE);
    let asset: Asset | undefined;
    if (album) {
      asset = await Asset.create(item.uri, album);
    } else {
      // Android creates an album from its first file.
      const created = await Album.create(ALBUM_TITLE, [item.uri]);
      asset = await latestAssetIn(created);
    }
    if (!asset) {
      throw new Error('The file was saved but could not be found in the School Admin album.');
    }
    return { ...item, uri: asset.id };
  } finally {
    deleteTemporaryFile(item.uri);
  }
}

// Newest first by the time each file was written. Edited photos and notice cards have no
// "date taken", and an edited video would otherwise sort by when the original was recorded.
export async function listAlbumItems(offset = 0, limit = ALBUM_PAGE_SIZE): Promise<MediaItem[]> {
  const album = await Album.get(ALBUM_TITLE);
  if (!album) {
    return [];
  }
  const rows = await new Query()
    .album(album)
    .orderBy({ key: AssetField.MODIFICATION_TIME, ascending: false })
    .offset(offset)
    .limit(limit)
    .exeForMetadata();
  return rows
    .filter((row) => row.mediaType === MediaType.IMAGE || row.mediaType === MediaType.VIDEO)
    .map((row) => ({
      uri: row.id,
      kind: row.mediaType === MediaType.VIDEO ? 'video' : 'image',
      width: row.width ?? 0,
      height: row.height ?? 0,
      durationMs: row.duration,
    }));
}

export async function deleteFromAlbum(items: MediaItem[]): Promise<void> {
  await Asset.delete(items.map((item) => new Asset(item.uri)));
}
