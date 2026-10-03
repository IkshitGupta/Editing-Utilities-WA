import { TextInput, type TextInputProps } from 'react-native';

import { cn } from '@/lib/utils';
import { ui } from '@/theme/colors';

export function Input({ className, multiline, ...props }: TextInputProps & { className?: string }) {
  return (
    <TextInput
      placeholderTextColor={ui.muted}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      className={cn(
        'rounded-xl border border-border bg-background px-3 text-base text-foreground',
        multiline ? 'min-h-28 py-3' : 'h-12',
        className
      )}
      {...props}
    />
  );
}
