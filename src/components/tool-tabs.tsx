import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/utils';
import { brand, ui } from '@/theme/colors';

import { Icon, type IconName } from './ui/icon';

export type ToolTab<T extends string> = {
  value: T;
  label: string;
  icon: IconName;
};

type ToolTabsProps<T extends string> = {
  tabs: readonly ToolTab<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function ToolTabs<T extends string>({ tabs, value, onChange }: ToolTabsProps<T>) {
  return (
    <View accessibilityRole="tablist" className="flex-row border-t border-border bg-background">
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.value)}
            className="flex-1 items-center gap-0.5 py-2">
            <Icon name={tab.icon} size={22} color={selected ? brand.blue : ui.muted} />
            <Text
              className={cn('text-xs', selected ? 'font-semibold text-brand-blue' : 'text-muted')}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
