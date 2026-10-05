import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { removeOldTemporaryFiles } from '@/lib/files';
import { brand, ui } from '@/theme/colors';

const CLEANUP_DELAY_MS = 3000;

export default function RootLayout() {
  // Runs once the first screen is up, so it never delays the start.
  useEffect(() => {
    const timer = setTimeout(() => removeOldTemporaryFiles(), CLEANUP_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: brand.navy,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: ui.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="image-editor" options={{ title: 'Edit photo' }} />
        <Stack.Screen name="video-editor" options={{ title: 'Edit video' }} />
        <Stack.Screen name="notice-card" options={{ title: 'Notice card' }} />
        <Stack.Screen name="saved" options={{ title: 'Saved', headerBackVisible: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
