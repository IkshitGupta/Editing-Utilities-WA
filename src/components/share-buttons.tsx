import { View } from 'react-native';

import type { MediaItem } from '@/features/media/types';
import { shareTo } from '@/features/share/share';
import { cn } from '@/lib/utils';

import { Button } from './ui/button';

type ShareButtonsProps = {
  items: MediaItem[];
  className?: string;
};

export function ShareButtons({ items, className }: ShareButtonsProps) {
  const hasItems = items.length > 0;
  const singleVideo = items.length === 1 && items[0].kind === 'video';
  return (
    <View className={cn('gap-3', className)}>
      <Button
        size="lg"
        variant="whatsapp"
        icon="logo-whatsapp"
        label="Share to WhatsApp"
        disabled={!hasItems}
        onPress={() => shareTo('whatsapp', items)}
      />
      <Button
        size="lg"
        variant="facebook"
        icon="logo-facebook"
        label="Post to Facebook"
        disabled={!hasItems}
        onPress={() => shareTo('facebook', items)}
      />
      {singleVideo ? (
        <Button
          size="lg"
          variant="youtube"
          icon="logo-youtube"
          label="Upload to YouTube"
          onPress={() => shareTo('youtube', items)}
        />
      ) : null}
    </View>
  );
}
