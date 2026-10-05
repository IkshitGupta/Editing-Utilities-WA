import { z } from 'zod';

import { SCHOOL } from '@/school/defaults';

export const WHATSAPP_APPS = ['business', 'personal'] as const;

// Each field falls back to its default on its own, so one bad stored value never resets the rest.
export const settingsSchema = z.object({
  schoolName: z.string().trim().min(1).catch(SCHOOL.name),
  address: z.string().trim().catch(SCHOOL.address),
  phone: z.string().trim().catch(SCHOOL.phone),
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
  logoUri: null,
  whatsappApp: 'business',
  mediaAccessAnsweredFor: null,
};

export function parseSettings(raw: unknown): Settings {
  const stored = typeof raw === 'object' && raw !== null ? raw : {};
  return settingsSchema.parse({ ...DEFAULT_SETTINGS, ...stored });
}
