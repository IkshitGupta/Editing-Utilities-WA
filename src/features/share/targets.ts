import type { MediaKind } from '@/features/media/types';
import type { WhatsAppChoice } from '@/features/settings/settings';

export type ShareDestination = 'whatsapp' | 'facebook' | 'youtube';

export const APPS = {
  whatsappBusiness: { packageName: 'com.whatsapp.w4b', label: 'WhatsApp Business' },
  whatsapp: { packageName: 'com.whatsapp', label: 'WhatsApp' },
  facebook: { packageName: 'com.facebook.katana', label: 'Facebook' },
  youtube: { packageName: 'com.google.android.youtube', label: 'YouTube' },
} as const;

export type AppInfo = (typeof APPS)[keyof typeof APPS];

// WhatsApp accepts up to 100 photos and videos in one share.
export const WHATSAPP_MAX_ITEMS = 100;

export function targetApp(
  destination: ShareDestination,
  choices: { whatsappApp: WhatsAppChoice }
): AppInfo {
  switch (destination) {
    case 'whatsapp':
      return choices.whatsappApp === 'business' ? APPS.whatsappBusiness : APPS.whatsapp;
    case 'facebook':
      return APPS.facebook;
    case 'youtube':
      return APPS.youtube;
  }
}

export function shareMimeType(kinds: MediaKind[]): string {
  const hasImage = kinds.includes('image');
  const hasVideo = kinds.includes('video');
  if (hasImage && hasVideo) {
    return '*/*';
  }
  return hasVideo ? 'video/*' : 'image/*';
}

export type ShareCheck = { ok: true } | { ok: false; message: string };

export function checkShare(destination: ShareDestination, kinds: MediaKind[]): ShareCheck {
  if (kinds.length === 0) {
    return { ok: false, message: 'Select at least one photo or video.' };
  }
  if (destination === 'youtube' && (kinds.length !== 1 || kinds[0] !== 'video')) {
    return { ok: false, message: 'Select one video to upload to YouTube.' };
  }
  if (destination === 'whatsapp' && kinds.length > WHATSAPP_MAX_ITEMS) {
    return {
      ok: false,
      message: `Select up to ${WHATSAPP_MAX_ITEMS} photos and videos to share at once.`,
    };
  }
  return { ok: true };
}
