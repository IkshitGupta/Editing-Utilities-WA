import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { brand, ui } from '@/theme/colors';

export default function RootLayout() {
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
