import { Pressable, ScrollView, Text, View } from 'react-native';

import { cn } from '@/lib/utils';
import { ui } from '@/theme/colors';

import { Icon, type IconName } from './icon';

export type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
};

type ChoiceChipsProps<T extends string> = {
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  className,
}: ChoiceChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      className={className}
      contentContainerClassName="gap-2 py-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            className={cn(
              'h-10 flex-row items-center gap-1.5 rounded-full border px-4',
              selected ? 'border-brand-blue bg-brand-blue' : 'border-border bg-background'
            )}>
            {option.icon ? (
              <Icon name={option.icon} size={16} color={selected ? '#FFFFFF' : ui.foreground} />
            ) : null}
            <Text
              className={cn('text-sm font-medium', selected ? 'text-white' : 'text-foreground')}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
      <View className="w-1" />
    </ScrollView>
  );
}
