import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { cn } from '@/lib/utils';

type SectionProps = {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
};

export function Section({ title, hint, children, className }: SectionProps) {
  return (
    <View className={cn('gap-2', className)}>
      <Text className="text-xs font-bold uppercase tracking-wider text-muted">{title}</Text>
      {hint ? <Text className="text-sm text-muted">{hint}</Text> : null}
      {children}
    </View>
  );
}
