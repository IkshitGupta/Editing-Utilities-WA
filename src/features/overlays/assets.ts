import { useFonts, useImage } from '@shopify/react-native-skia';

import { useSettings } from '@/features/settings/store';

export const BUNDLED_LOGO = require('@/assets/images/school-logo.png');

// Noto Sans is bundled so notices and captions look the same on every phone.
export function useOverlayFonts() {
  return useFonts({
    'Noto Sans': [
      require('@/assets/fonts/NotoSans-Regular.ttf'),
      require('@/assets/fonts/NotoSans-Bold.ttf'),
    ],
  });
}

export function useLogoImage() {
  const { logoUri } = useSettings();
  return useImage(logoUri ?? BUNDLED_LOGO);
}

// For React Native and expo-image components rather than Skia.
export function logoSource(logoUri: string | null) {
  return logoUri ? { uri: logoUri } : BUNDLED_LOGO;
}
