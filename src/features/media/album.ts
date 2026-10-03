import {
  Album,
  Asset,
  AssetField,
  MediaType,
  Query,
  requestPermissionsAsync,
} from 'expo-media-library';

import { ALBUM_TITLE } from '@/school/defaults';

import type { MediaItem } from './types';

const GRANULAR: ('photo' | 'video')[] = ['photo', 'video'];

export async function requestLibraryAccess(): Promise<boolean> {
  const response = await requestPermissionsAsync(false, GRANULAR);
  return response.granted;
}

async function latestAssetIn(album: Album): Promise<Asset | undefined> {
  const [latest] = await new Query()
    .album(album)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .limit(1)
    .exe();
  return latest;
}

// Saves a file the app made into the "School Admin" album and returns the gallery copy,
// whose content:// URI other apps can open.
export async function saveToAlbum(item: MediaItem): Promise<MediaItem> {
  await requestLibraryAccess();
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
}

export async function listAlbumItems(limit = 500): Promise<MediaItem[]> {
  const album = await Album.get(ALBUM_TITLE);
  if (!album) {
    return [];
  }
  const rows = await new Query()
    .album(album)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
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
