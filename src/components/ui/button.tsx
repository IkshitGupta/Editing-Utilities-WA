import { cva } from 'class-variance-authority';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

import { cn } from '@/lib/utils';
import { brand, ui } from '@/theme/colors';

import { Icon, type IconName } from './icon';

const buttonVariants = cva('flex-row items-center justify-center rounded-xl active:opacity-80', {
  variants: {
    variant: {
      primary: 'bg-brand-blue',
      accent: 'bg-brand-magenta',
      secondary: 'border border-border bg-surface',
      outline: 'border border-brand-blue bg-background',
      ghost: 'bg-transparent',
      danger: 'bg-danger',
      whatsapp: 'bg-whatsapp',
      facebook: 'bg-facebook',
      youtube: 'bg-youtube',
    },
    size: {
      sm: 'h-10 gap-1.5 px-3',
      md: 'h-12 gap-2 px-4',
      lg: 'h-14 gap-2.5 px-5',
      icon: 'h-11 w-11',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

export type ButtonVariant =
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'whatsapp'
  | 'facebook'
  | 'youtube';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const LIGHT_CONTENT: ButtonVariant[] = [
  'primary',
  'accent',
  'danger',
  'whatsapp',
  'facebook',
  'youtube',
];
const TEXT_SIZE: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  icon: 'text-base',
};
const ICON_SIZE: Record<ButtonSize, number> = { sm: 16, md: 20, lg: 22, icon: 22 };

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label?: string;
  icon?: IconName;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
};

export function Button({
  label,
  icon,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled) || loading;
  const contentColor = LIGHT_CONTENT.includes(variant)
    ? '#FFFFFF'
    : variant === 'secondary'
      ? ui.foreground
      : brand.blue;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={cn(buttonVariants({ variant, size }), isDisabled && 'opacity-50', className)}
      {...props}>
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : icon ? (
        <Icon name={icon} size={ICON_SIZE[size]} color={contentColor} />
      ) : null}
      {label ? (
        <Text className={cn('font-semibold', TEXT_SIZE[size])} style={{ color: contentColor }}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}
