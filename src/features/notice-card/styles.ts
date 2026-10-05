import { brand } from '@/theme/colors';

export type DesignId = 'letterhead' | 'band' | 'minimal';
export type ThemeId = 'royal' | 'magenta' | 'sunshine';
export type CardSizeId = 'square' | 'portrait';

export type NoticeStyle = {
  design: DesignId;
  theme: ThemeId;
  size: CardSizeId;
};

export type Theme = {
  label: string;
  primary: string;
  // Text drawn on top of the primary colour.
  onPrimary: string;
  // Titles on a white background.
  heading: string;
  dark: string;
  accent: string;
  tint: string;
};

export const THEMES: Record<ThemeId, Theme> = {
  royal: {
    label: 'Royal blue',
    primary: brand.blue,
    onPrimary: '#FFFFFF',
    heading: brand.blue,
    dark: brand.navy,
    accent: brand.yellow,
    tint: '#EEF3FF',
  },
  magenta: {
    label: 'Magenta',
    primary: brand.magenta,
    onPrimary: '#FFFFFF',
    heading: brand.magenta,
    dark: '#6E0A44',
    accent: brand.yellow,
    tint: brand.blush,
  },
  sunshine: {
    label: 'Yellow',
    primary: '#F5C400',
    onPrimary: brand.navy,
    heading: brand.navy,
    dark: brand.navy,
    accent: brand.magenta,
    tint: '#FFF9DB',
  },
};

export const DESIGNS: readonly { value: DesignId; label: string }[] = [
  { value: 'letterhead', label: 'Letterhead' },
  { value: 'band', label: 'Colour band' },
  { value: 'minimal', label: 'Simple' },
];

export const CARD_SIZES: Record<CardSizeId, { label: string; width: number; height: number }> = {
  square: { label: 'Square', width: 1080, height: 1080 },
  portrait: { label: 'Portrait 4:5', width: 1080, height: 1350 },
};

export const DEFAULT_NOTICE_STYLE: NoticeStyle = {
  design: 'letterhead',
  theme: 'royal',
  size: 'portrait',
};
