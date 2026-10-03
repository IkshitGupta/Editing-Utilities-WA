import { View } from 'react-native';

import { clamp } from '@/lib/utils';

export function ProgressBar({ value }: { value: number }) {
  const percent = clamp(value, 0, 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
      className="h-3 w-full overflow-hidden rounded-full bg-border">
      <View className="h-full rounded-full bg-brand-blue" style={{ width: `${percent}%` }} />
    </View>
  );
}
