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
});

export type Settings = z.infer<typeof settingsSchema>;
export type WhatsAppChoice = Settings['whatsappApp'];

export const DEFAULT_SETTINGS: Settings = {
  schoolName: SCHOOL.name,
  address: SCHOOL.address,
  phone: SCHOOL.phone,
  logoUri: null,
  whatsappApp: 'business',
};

export function parseSettings(raw: unknown): Settings {
  const stored = typeof raw === 'object' && raw !== null ? raw : {};
  return settingsSchema.parse({ ...DEFAULT_SETTINGS, ...stored });
}
