import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { ui } from '@/theme/colors';

import { Button } from './ui/button';
import { Icon } from './ui/icon';

type EmptyStateProps = {
  title: string;
  message?: string;
  showBack?: boolean;
  children?: ReactNode;
};

export function EmptyState({ title, message, showBack = false, children }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background px-8">
      <Icon name="images-outline" size={48} color={ui.muted} />
      <Text className="text-center text-lg font-semibold text-foreground">{title}</Text>
      {message ? <Text className="text-center text-base text-muted">{message}</Text> : null}
      {children}
      {showBack ? (
        <Button
          variant="secondary"
          icon="arrow-back"
          label="Go back"
          onPress={() => router.back()}
        />
      ) : null}
    </View>
  );
}
