import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import type { MediaItem } from '@/features/media/types';
import { formatDuration } from '@/lib/format';

import { Icon } from './ui/icon';

type MediaThumbProps = {
  item: MediaItem;
  size: number;
  // 1-based position in the selection, shown so the sharing order is clear.
  selectionNumber?: number;
  selectable?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
};

export function MediaThumb({
  item,
  size,
  selectionNumber,
  selectable = true,
  onPress,
  onLongPress,
}: MediaThumbProps) {
  const selected = selectionNumber !== undefined;
  return (
    <Pressable
      accessibilityRole={selectable ? 'checkbox' : 'image'}
      accessibilityLabel={item.kind === 'video' ? 'Video' : 'Photo'}
      accessibilityState={selectable ? { checked: selected } : undefined}
      disabled={!onPress && !onLongPress}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ width: size, height: size }}
      className="p-0.5">
      <Image
        source={{ uri: item.uri }}
        style={{ flex: 1, borderRadius: 10 }}
        contentFit="cover"
        recyclingKey={item.uri}
        transition={120}
      />
      {item.kind === 'video' ? (
        <View className="absolute bottom-1.5 left-1.5 flex-row items-center gap-1 rounded-full bg-black/60 px-2 py-0.5">
          <Icon name="play" size={12} color="#FFFFFF" />
          <Text className="text-xs font-semibold text-white">
            {formatDuration(item.durationMs)}
          </Text>
        </View>
      ) : null}
      {selected ? (
        <View className="absolute inset-0.5 rounded-[10px] border-4 border-brand-blue">
          <View className="absolute right-1 top-1 h-7 w-7 items-center justify-center rounded-full bg-brand-blue">
            <Text className="text-sm font-bold text-white">{selectionNumber}</Text>
          </View>
        </View>
      ) : selectable ? (
        <View className="absolute right-1.5 top-1.5 h-6 w-6 rounded-full border-2 border-white bg-black/20" />
      ) : null}
    </Pressable>
  );
}
