import { Image } from 'expo-image';
import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Icon } from '@/components/ui/icon';
import { formatDuration } from '@/lib/format';
import { clamp } from '@/lib/utils';
import { brand } from '@/theme/colors';

import type { VideoClip } from './edit-list';

const HANDLE_WIDTH = 24;

type TrimHandle = 'start' | 'end';

type TrimBarProps = {
  clip: VideoClip;
  thumbnails: string[];
  positionMs: number;
  // Each drag step is reported as a change in milliseconds, so the latest trim is always the base.
  onTrim: (handle: TrimHandle, deltaMs: number) => void;
  onSeek: (ms: number) => void;
};

export function TrimBar({ clip, thumbnails, positionMs, onTrim, onSeek }: TrimBarProps) {
  const [width, setWidth] = useState(0);

  const duration = Math.max(1, clip.durationMs);
  const track = Math.max(1, width - HANDLE_WIDTH * 2);
  const toX = (ms: number) => HANDLE_WIDTH + (clamp(ms, 0, duration) / duration) * track;
  const toMs = (dx: number) => (dx / track) * duration;

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const handleDrag = (handle: TrimHandle) =>
    Gesture.Pan()
      .runOnJS(true)
      .hitSlop({ horizontal: 16, vertical: 12 })
      .onChange((event) => onTrim(handle, toMs(event.changeX)));

  const startHandle = handleDrag('start');
  const endHandle = handleDrag('end');

  const seekTap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event, success) => {
      if (success) {
        onSeek(clamp(toMs(event.x), 0, duration));
      }
    });

  const startX = toX(clip.startMs);
  const endX = toX(clip.endMs);

  return (
    // The inset keeps the handles clear of the screen edges, where a sideways swipe means Back.
    <View className="gap-1 px-6">
      <View className="h-16 justify-center" onLayout={onLayout}>
        {width > 0 ? (
          <>
            <GestureDetector gesture={seekTap}>
              <View
                className="absolute h-14 flex-row overflow-hidden rounded-lg bg-black"
                style={{ left: HANDLE_WIDTH, right: HANDLE_WIDTH }}>
                {thumbnails.map((uri) => (
                  <Image key={uri} source={{ uri }} style={{ flex: 1 }} contentFit="cover" />
                ))}
              </View>
            </GestureDetector>
            <View
              className="pointer-events-none absolute h-14 bg-black/60"
              style={{ left: HANDLE_WIDTH, width: Math.max(0, startX - HANDLE_WIDTH) }}
            />
            <View
              className="pointer-events-none absolute h-14 bg-black/60"
              style={{ left: endX, width: Math.max(0, width - HANDLE_WIDTH - endX) }}
            />
            <View
              className="pointer-events-none absolute h-14 border-y-4 border-brand-yellow"
              style={{ left: startX, width: Math.max(0, endX - startX) }}
            />
            <View
              className="pointer-events-none absolute h-16 w-1 rounded-full bg-white"
              style={{ left: toX(positionMs) - 2 }}
            />
            <GestureDetector gesture={startHandle}>
              <View
                accessibilityLabel="Trim start"
                className="absolute h-16 items-center justify-center rounded-l-lg bg-brand-yellow"
                style={{ left: startX - HANDLE_WIDTH, width: HANDLE_WIDTH }}>
                <Icon name="chevron-back" size={18} color={brand.navy} />
              </View>
            </GestureDetector>
            <GestureDetector gesture={endHandle}>
              <View
                accessibilityLabel="Trim end"
                className="absolute h-16 items-center justify-center rounded-r-lg bg-brand-yellow"
                style={{ left: endX, width: HANDLE_WIDTH }}>
                <Icon name="chevron-forward" size={18} color={brand.navy} />
              </View>
            </GestureDetector>
          </>
        ) : null}
      </View>
      <View className="flex-row justify-between px-1">
        <Text className="text-xs text-muted">{formatDuration(clip.startMs)}</Text>
        <Text className="text-xs font-semibold text-foreground">
          Keeps {formatDuration(clip.endMs - clip.startMs)}
        </Text>
        <Text className="text-xs text-muted">{formatDuration(clip.endMs)}</Text>
      </View>
    </View>
  );
}
