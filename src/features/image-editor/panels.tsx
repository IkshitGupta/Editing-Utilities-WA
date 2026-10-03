import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { Icon } from '@/components/ui/icon';
import { Section } from '@/components/ui/section';
import { cn } from '@/lib/utils';
import { brand } from '@/theme/colors';

import { rotateClockwise, rotateCounterClockwise } from './geometry';
import { CROP_SHAPES, OUTPUT_PRESET_ORDER, OUTPUT_PRESETS } from './presets';
import type { CropShapeId, ImageEdit, OutputPresetId } from './types';

const SHAPE_OPTIONS = CROP_SHAPES.map((shape) => ({ value: shape.id, label: shape.label }));

type PanelProps = {
  edit: ImageEdit;
  onChange: (patch: Partial<ImageEdit>) => void;
};

export function CropPanel({ edit, onChange }: PanelProps) {
  const fixedBy = OUTPUT_PRESETS[edit.output].shape ? OUTPUT_PRESETS[edit.output] : null;
  const chooseShape = (shape: CropShapeId) => {
    // A fixed-size output only fits its own shape, so another shape switches to WhatsApp size.
    const output = fixedBy && fixedBy.shape !== shape ? 'whatsapp' : edit.output;
    onChange({ shape, output, zoom: 1, panX: 0, panY: 0 });
  };
  return (
    <View className="gap-4">
      <Section title="Shape" hint="Drag the photo to move it inside the frame. Pinch to zoom.">
        <ChoiceChips options={SHAPE_OPTIONS} value={edit.shape} onChange={chooseShape} />
      </Section>
      <View className="flex-row flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          icon="arrow-redo-outline"
          label="Turn right"
          onPress={() => onChange({ rotation: rotateClockwise(edit.rotation), panX: 0, panY: 0 })}
        />
        <Button
          size="sm"
          variant="secondary"
          icon="arrow-undo-outline"
          label="Turn left"
          onPress={() =>
            onChange({ rotation: rotateCounterClockwise(edit.rotation), panX: 0, panY: 0 })
          }
        />
        <Button
          size="sm"
          variant={edit.flipX ? 'primary' : 'secondary'}
          icon="swap-horizontal"
          label="Mirror"
          onPress={() => onChange({ flipX: !edit.flipX })}
        />
        <Button
          size="sm"
          variant="ghost"
          icon="close-circle-outline"
          label="Reset"
          onPress={() => onChange({ rotation: 0, flipX: false, zoom: 1, panX: 0, panY: 0 })}
        />
      </View>
    </View>
  );
}

type SizePanelProps = PanelProps & {
  resultSize: { width: number; height: number } | null;
};

export function SizePanel({ edit, onChange, resultSize }: SizePanelProps) {
  const choose = (id: OutputPresetId) => {
    const preset = OUTPUT_PRESETS[id];
    onChange(
      preset.shape ? { output: id, shape: preset.shape, zoom: 1, panX: 0, panY: 0 } : { output: id }
    );
  };
  return (
    <View className="gap-2">
      {OUTPUT_PRESET_ORDER.map((id) => {
        const preset = OUTPUT_PRESETS[id];
        const selected = edit.output === id;
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => choose(id)}
            className={cn(
              'flex-row items-center gap-3 rounded-xl border px-4 py-3',
              selected ? 'border-brand-blue bg-brand-blue/10' : 'border-border bg-background'
            )}>
            <Icon
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={brand.blue}
            />
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">{preset.label}</Text>
              <Text className="text-sm text-muted">{preset.hint}</Text>
            </View>
          </Pressable>
        );
      })}
      {resultSize ? (
        <Text className="pt-1 text-sm text-muted">
          Will save as {resultSize.width} × {resultSize.height} pixels.
        </Text>
      ) : null}
    </View>
  );
}
