import { Pressable, View } from 'react-native';

import { cn } from '@/lib/utils';

type ColorSwatchesProps = {
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
};

export function ColorSwatches({ colors, value, onChange }: ColorSwatchesProps) {
  return (
    <View className="flex-row flex-wrap gap-3 py-1">
      {colors.map((color) => {
        const selected = color.toLowerCase() === value.toLowerCase();
        return (
          <Pressable
            key={color}
            accessibilityRole="radio"
            accessibilityLabel={`Colour ${color}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(color)}
            className={cn(
              'h-10 w-10 items-center justify-center rounded-full border-2',
              selected ? 'border-brand-blue' : 'border-transparent'
            )}>
            <View
              className="h-8 w-8 rounded-full border border-border"
              style={{ backgroundColor: color }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
