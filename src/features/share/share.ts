import { Alert } from 'react-native';

import SchoolMedia from '@modules/school-media';

import type { MediaItem } from '@/features/media/types';
import { getSettings } from '@/features/settings/store';
import { errorMessage } from '@/lib/errors';

import { checkShare, shareMimeType, targetApp, type ShareDestination } from './targets';

// Opens WhatsApp, Facebook or YouTube with the items attached; the person posting
// picks the chat or page and taps send in that app.
export async function shareTo(destination: ShareDestination, items: MediaItem[]): Promise<void> {
  const kinds = items.map((item) => item.kind);
  const check = checkShare(destination, kinds);
  if (!check.ok) {
    Alert.alert('Cannot share', check.message);
    return;
  }
  const app = targetApp(destination, getSettings());
  try {
    await SchoolMedia.shareFiles(
      items.map((item) => item.uri),
      shareMimeType(kinds),
      app.packageName,
      'Share'
    );
  } catch (error) {
    Alert.alert(`Could not open ${app.label}`, errorMessage(error));
  }
}

export function isAppInstalled(packageName: string): boolean {
  try {
    return SchoolMedia.isAppInstalled(packageName);
  } catch {
    return false;
  }
}
