import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BusyModal } from '@/components/busy-modal';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { pickMedia, takePhoto } from '@/features/media/picker';
import type { MediaItem } from '@/features/media/types';
import { logoSource } from '@/features/overlays/assets';
import { useSettings } from '@/features/settings/store';
import { shareTo } from '@/features/share/share';
import { WHATSAPP_MAX_ITEMS } from '@/features/share/targets';
import { errorMessage } from '@/lib/errors';
import { putTransfer } from '@/lib/transfer';
import { brand, ui } from '@/theme/colors';

type TileProps = {
  icon: IconName;
  color: string;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function Tile({ icon, color, title, subtitle, onPress }: TileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      className="min-h-36 flex-1 gap-3 rounded-2xl border border-border bg-background p-4 active:opacity-80">
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: color }}>
        <Icon name={icon} size={26} color="#FFFFFF" />
      </View>
      <View className="gap-0.5">
        <Text className="text-lg font-bold text-foreground">{title}</Text>
        <Text className="text-sm text-muted">{subtitle}</Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const [busy, setBusy] = useState(false);

  // The photo picker copies videos into the app first, which can take a moment.
  const pickThen = async (
    pick: () => Promise<MediaItem[]>,
    then: (items: MediaItem[]) => void | Promise<void>
  ) => {
    try {
      setBusy(true);
      const items = await pick();
      setBusy(false);
      if (items.length > 0) {
        await then(items);
      }
    } catch (error) {
      setBusy(false);
      Alert.alert('Something went wrong', errorMessage(error));
    }
  };

  const openEditor = (pathname: '/image-editor' | '/video-editor') => (items: MediaItem[]) =>
    router.push({ pathname, params: { transfer: putTransfer(items) } });

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 px-4 pb-8"
      contentContainerStyle={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center gap-3">
        <Image
          source={logoSource(settings.logoUri)}
          style={{ width: 56, height: 56 }}
          contentFit="contain"
        />
        <View className="flex-1">
          <Text className="text-2xl font-bold text-brand-navy">{settings.schoolName}</Text>
          <Text className="text-base text-muted">What would you like to do?</Text>
        </View>
      </View>

      <View className="flex-row gap-3">
        <Tile
          icon="images-outline"
          color={brand.blue}
          title="Edit photos"
          subtitle="Crop, add text and the logo"
          onPress={() =>
            pickThen(
              () => pickMedia({ kinds: ['image'], multiple: true, limit: 30 }),
              openEditor('/image-editor')
            )
          }
        />
        <Tile
          icon="videocam-outline"
          color={brand.magenta}
          title="Edit a video"
          subtitle="Trim, music, join clips"
          onPress={() =>
            pickThen(
              () => pickMedia({ kinds: ['video'], multiple: true, limit: 10 }),
              openEditor('/video-editor')
            )
          }
        />
      </View>

      <View className="flex-row gap-3">
        <Tile
          icon="document-text-outline"
          color={brand.navy}
          title="Notice card"
          subtitle="Type a notice, get a picture"
          onPress={() => router.push('/notice-card')}
        />
        <Tile
          icon="logo-whatsapp"
          color={ui.whatsapp}
          title="Share to WhatsApp"
          subtitle="Send to class groups"
          onPress={() =>
            pickThen(
              () =>
                pickMedia({ kinds: ['image', 'video'], multiple: true, limit: WHATSAPP_MAX_ITEMS }),
              (items) => shareTo('whatsapp', items)
            )
          }
        />
      </View>

      <View className="flex-row gap-3">
        <Tile
          icon="logo-facebook"
          color={ui.facebook}
          title="Post to Facebook"
          subtitle="The school Page"
          onPress={() =>
            pickThen(
              () => pickMedia({ kinds: ['image', 'video'], multiple: true, limit: 30 }),
              (items) => shareTo('facebook', items)
            )
          }
        />
        <Tile
          icon="logo-youtube"
          color={ui.youtube}
          title="Upload to YouTube"
          subtitle="One video at a time"
          onPress={() =>
            pickThen(
              () => pickMedia({ kinds: ['video'], multiple: false }),
              (items) => shareTo('youtube', items)
            )
          }
        />
      </View>

      <Button
        variant="secondary"
        icon="camera-outline"
        label="Take a photo and edit it"
        onPress={() =>
          pickThen(async () => {
            const photo = await takePhoto();
            return photo ? [photo] : [];
          }, openEditor('/image-editor'))
        }
      />

      <View className="flex-row gap-3 rounded-2xl bg-brand-blue/10 p-4">
        <Icon name="information-circle-outline" size={22} color={brand.blue} />
        <Text className="flex-1 text-sm text-foreground">
          Everything you edit is saved in the School Admin album. Open the Media tab to share it
          again.
        </Text>
      </View>
      <BusyModal visible={busy} title="Getting your photos and videos ready…" />
    </ScrollView>
  );
}
