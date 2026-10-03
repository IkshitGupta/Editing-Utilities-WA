import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { MediaThumb } from '@/components/media-thumb';
import { ShareButtons } from '@/components/share-buttons';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import type { MediaItem } from '@/features/media/types';
import { plural } from '@/lib/format';
import { readTransfer } from '@/lib/transfer';
import { ui } from '@/theme/colors';

export default function SavedScreen() {
  const params = useLocalSearchParams<{ transfer?: string }>();
  const items = readTransfer<MediaItem[]>(params.transfer) ?? [];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const done = () => {
    if (router.canDismiss()) {
      router.dismissAll();
    } else {
      router.replace('/');
    }
  };

  if (items.length === 0) {
    return <EmptyState title="Nothing was saved" showBack />;
  }

  const thumbSize = Math.floor((width - 32) / 3);
  const kind = items.every((item) => item.kind === 'video')
    ? 'video'
    : items.every((item) => item.kind === 'image')
      ? 'photo'
      : 'item';

  return (
    <View className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="gap-5 p-4">
        <View className="flex-row items-center gap-3">
          <Icon name="checkmark-circle" size={32} color={ui.success} />
          <View className="flex-1">
            <Text className="text-xl font-bold text-foreground">
              Saved {plural(items.length, kind)}
            </Text>
            <Text className="text-sm text-muted">In the School Admin album on this phone.</Text>
          </View>
        </View>
        <View className="flex-row flex-wrap">
          {items.map((item, index) => (
            <MediaThumb
              key={`${item.uri}-${index}`}
              item={item}
              size={thumbSize}
              selectable={false}
            />
          ))}
        </View>
        <Text className="text-base text-foreground">
          Share now? Pick the class groups or Page in the next app.
        </Text>
        <ShareButtons items={items} />
      </ScrollView>
      <View
        className="border-t border-border bg-background px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}>
        <Button variant="secondary" icon="home-outline" label="Done" onPress={done} />
      </View>
    </View>
  );
}
