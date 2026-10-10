import { z } from 'zod';

import { SCHOOL } from '@/school/defaults';

export const WHATSAPP_APPS = ['business', 'personal'] as const;

// Each field falls back to its default on its own, so one bad stored value never resets the rest.
export const settingsSchema = z.object({
  schoolName: z.string().trim().min(1).catch(SCHOOL.name),
  address: z.string().trim().catch(SCHOOL.address),
  phone: z.string().trim().catch(SCHOOL.phone),
  website: z.string().trim().catch(SCHOOL.website),
  logoUri: z.string().min(1).nullable().catch(null),
  whatsappApp: z.enum(WHATSAPP_APPS).catch('business'),
  // Install time of the installation on which the Media tab's photo access question was answered.
  // Android can restore settings from a backup made by an earlier installation, whose saves may no
  // longer count as the app's own; its different install time brings the question back.
  mediaAccessAnsweredFor: z.number().nullable().catch(null),
});

export type Settings = z.infer<typeof settingsSchema>;
export type WhatsAppChoice = Settings['whatsappApp'];

export const DEFAULT_SETTINGS: Settings = {
  schoolName: SCHOOL.name,
  address: SCHOOL.address,
  phone: SCHOOL.phone,
  website: SCHOOL.website,
  logoUri: null,
  whatsappApp: 'business',
  mediaAccessAnsweredFor: null,
};

export function parseSettings(raw: unknown): Settings {
  const stored = typeof raw === 'object' && raw !== null ? raw : {};
  return settingsSchema.parse({ ...DEFAULT_SETTINGS, ...stored });
}

// Only values that differ from the defaults are stored, so a later change to a default reaches
// every install that kept it. Settings stored before the revision mark hold every value, defaults
// included; a phone among them that equals the earlier default was never typed in, so it follows
// the current default.
export const SETTINGS_REVISION = 1;
const EARLIER_DEFAULT_PHONE = '96948 53435';

export function parseStoredSettings(raw: unknown): Settings {
  const settings = parseSettings(raw);
  const revision =
    typeof raw === 'object' && raw !== null ? (raw as { revision?: unknown }).revision : undefined;
  if (typeof revision !== 'number' && settings.phone === EARLIER_DEFAULT_PHONE) {
    return { ...settings, phone: SCHOOL.phone };
  }
  return settings;
}

export function toStoredSettings(settings: Settings): Record<string, unknown> {
  const changed = Object.entries(settings).filter(
    ([key, value]) => value !== DEFAULT_SETTINGS[key as keyof Settings]
  );
  return { ...Object.fromEntries(changed), revision: SETTINGS_REVISION };
}
