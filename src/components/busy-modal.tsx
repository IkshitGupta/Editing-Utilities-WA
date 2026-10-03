import { ActivityIndicator, Modal, Text, View } from 'react-native';

import { brand } from '@/theme/colors';

import { Button } from './ui/button';
import { ProgressBar } from './ui/progress-bar';

type BusyModalProps = {
  visible: boolean;
  title: string;
  message?: string;
  // 0 to 100, or null while the amount of work is unknown.
  progress?: number | null;
  onCancel?: () => void;
};

export function BusyModal({ visible, title, message, progress = null, onCancel }: BusyModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => onCancel?.()}>
      <View className="flex-1 items-center justify-center bg-black/50 px-8">
        <View className="w-full gap-4 rounded-2xl bg-background p-6">
          <Text className="text-lg font-bold text-foreground">{title}</Text>
          {message ? <Text className="text-base text-muted">{message}</Text> : null}
          {progress == null ? (
            <ActivityIndicator size="large" color={brand.blue} />
          ) : (
            <View className="gap-2">
              <ProgressBar value={progress} />
              <Text className="text-right text-sm text-muted">{Math.round(progress)}%</Text>
            </View>
          )}
          {onCancel ? <Button label="Cancel" variant="secondary" onPress={onCancel} /> : null}
        </View>
      </View>
    </Modal>
  );
}
