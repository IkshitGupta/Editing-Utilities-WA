import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import type { MediaItem, MediaKind } from './types';

type PickOptions = {
  kinds: MediaKind[];
  multiple: boolean;
  limit?: number;
};

function toMediaItem(asset: ImagePicker.ImagePickerAsset): MediaItem {
  const isVideo = asset.type === 'video' || (asset.mimeType?.startsWith('video/') ?? false);
  return {
    uri: asset.uri,
    kind: isVideo ? 'video' : 'image',
    width: asset.width,
    height: asset.height,
    durationMs: asset.duration ?? null,
  };
}

// Uses the Android photo picker, which needs no storage permission and keeps the tap order.
export async function pickMedia({ kinds, multiple, limit }: PickOptions): Promise<MediaItem[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kinds.map((kind) => (kind === 'image' ? 'images' : 'videos')),
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? (limit ?? 0) : 1,
    orderedSelection: true,
    quality: 1,
    exif: false,
  });
  if (result.canceled) {
    return [];
  }
  return result.assets.map(toMediaItem).filter((item) => kinds.includes(item.kind));
}

export async function takePhoto(): Promise<MediaItem | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Camera not allowed',
      'Allow camera access for Walnut Academy in your phone settings to take photos from the app.'
    );
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
    exif: false,
  });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  return toMediaItem(result.assets[0]);
}
