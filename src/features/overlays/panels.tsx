import { Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { ColorSwatches } from '@/components/ui/color-swatches';
import { Input } from '@/components/ui/input';
import { Section } from '@/components/ui/section';
import { clamp } from '@/lib/utils';
import { brand, ui } from '@/theme/colors';

import {
  OVERLAY_COLORS,
  SHAPE_SIZE_MIN,
  TEXT_SIZE_MAX,
  TEXT_SIZE_MIN,
  withLogoStyle,
  type ArrowDirection,
  type LogoPosition,
  type LogoSetting,
  type LogoSize,
  type LogoStyle,
  type ShapeKind,
  type ShapeOverlay,
  type TextOverlay,
  type TextStyleId,
} from './types';

const GROW = 1.15;

const TEXT_STYLES = [
  { value: 'shadow', label: 'Shadow' },
  { value: 'band', label: 'Background' },
  { value: 'plain', label: 'Plain' },
] as const satisfies readonly { value: TextStyleId; label: string }[];

type TextPanelProps = {
  overlay: TextOverlay | null;
  onAdd: () => void;
  onChange: (patch: Partial<TextOverlay>) => void;
  onDelete: () => void;
  hint: string;
  // Shown under the controls while a text is selected.
  note?: string;
  allowMultiple?: boolean;
};

export function TextPanel({
  overlay,
  onAdd,
  onChange,
  onDelete,
  hint,
  note,
  allowMultiple = true,
}: TextPanelProps) {
  if (!overlay) {
    return (
      <View className="gap-3">
        <Button icon="text" label="Add text" onPress={onAdd} />
        <Text className="text-sm text-muted">{hint}</Text>
      </View>
    );
  }
  return (
    <View className="gap-4">
      <Input
        multiline
        value={overlay.text}
        onChangeText={(text) => onChange({ text })}
        placeholder="Enter text"
        maxLength={160}
      />
      <Section title="Colour">
        <ColorSwatches
          colors={OVERLAY_COLORS}
          value={overlay.color}
          onChange={(color) => onChange({ color })}
        />
      </Section>
      <Section title="Style">
        <ChoiceChips
          options={TEXT_STYLES}
          value={overlay.style}
          onChange={(style) => onChange({ style })}
        />
      </Section>
      <View className="flex-row flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          icon="remove"
          label="Smaller"
          onPress={() =>
            onChange({ size: clamp(overlay.size / GROW, TEXT_SIZE_MIN, TEXT_SIZE_MAX) })
          }
        />
        <Button
          size="sm"
          variant="secondary"
          icon="add"
          label="Larger"
          onPress={() =>
            onChange({ size: clamp(overlay.size * GROW, TEXT_SIZE_MIN, TEXT_SIZE_MAX) })
          }
        />
        <Button
          size="sm"
          variant={overlay.bold ? 'primary' : 'secondary'}
          label="Bold"
          onPress={() => onChange({ bold: !overlay.bold })}
        />
      </View>
      <View className="flex-row gap-2">
        {allowMultiple ? (
          <Button
            className="flex-1"
            variant="secondary"
            icon="add-circle-outline"
            label="Add another"
            onPress={onAdd}
          />
        ) : null}
        <Button
          className="flex-1"
          variant="danger"
          icon="trash-outline"
          label="Remove"
          onPress={onDelete}
        />
      </View>
      {note ? <Text className="text-sm text-muted">{note}</Text> : null}
    </View>
  );
}

const SHAPES = [
  { value: 'rectangle', label: 'Rectangle', icon: 'square-outline' },
  { value: 'circle', label: 'Circle', icon: 'ellipse-outline' },
  { value: 'arrow', label: 'Arrow', icon: 'arrow-forward' },
  { value: 'line', label: 'Line', icon: 'remove-outline' },
] as const satisfies readonly { value: ShapeKind; label: string; icon: string }[];

const THICKNESS = [
  { value: 'thin', label: 'Thin' },
  { value: 'medium', label: 'Medium' },
  { value: 'thick', label: 'Thick' },
] as const;

const THICKNESS_VALUE = { thin: 0.007, medium: 0.012, thick: 0.02 } as const;

function thicknessName(value: number): keyof typeof THICKNESS_VALUE {
  if (value < 0.0095) {
    return 'thin';
  }
  return value < 0.016 ? 'medium' : 'thick';
}

const DIRECTIONS = [
  { value: 'right', label: 'Right', icon: 'arrow-forward' },
  { value: 'left', label: 'Left', icon: 'arrow-back' },
  { value: 'up', label: 'Up', icon: 'arrow-up' },
  { value: 'down', label: 'Down', icon: 'arrow-down' },
] as const satisfies readonly { value: ArrowDirection; label: string; icon: string }[];

const LINE_DIRECTIONS = [
  { value: 'right', label: 'Horizontal' },
  { value: 'down', label: 'Vertical' },
] as const satisfies readonly { value: ArrowDirection; label: string }[];

type ShapePanelProps = {
  shape: ShapeOverlay | null;
  onAdd: (kind: ShapeKind) => void;
  onChange: (patch: Partial<ShapeOverlay>) => void;
  onDelete: () => void;
};

export function ShapePanel({ shape, onAdd, onChange, onDelete }: ShapePanelProps) {
  if (!shape) {
    return (
      <View className="gap-3">
        {[SHAPES.slice(0, 2), SHAPES.slice(2)].map((row) => (
          <View key={row[0].value} className="flex-row gap-2">
            {row.map((option) => (
              <Button
                key={option.value}
                className="flex-1"
                variant="secondary"
                icon={option.icon}
                label={option.label}
                onPress={() => onAdd(option.value)}
              />
            ))}
          </View>
        ))}
        <Text className="text-sm text-muted">
          Use shapes to highlight part of the photo. Drag to move a shape and pinch to resize it.
        </Text>
      </View>
    );
  }
  const isHorizontal = (direction: ArrowDirection) => direction === 'left' || direction === 'right';
  // Keeps arrows and lines long along the way they point.
  const turnTo = (direction: ArrowDirection) => {
    const turned = isHorizontal(direction) !== isHorizontal(shape.direction);
    onChange(turned ? { direction, width: shape.height, height: shape.width } : { direction });
  };
  const resize = (factor: number) =>
    onChange({
      width: clamp(shape.width * factor, SHAPE_SIZE_MIN, 1),
      height: clamp(shape.height * factor, SHAPE_SIZE_MIN, 1),
    });
  return (
    <View className="gap-4">
      <Section title="Colour">
        <ColorSwatches
          colors={OVERLAY_COLORS}
          value={shape.color}
          onChange={(color) => onChange({ color })}
        />
      </Section>
      <Section title="Thickness">
        <ChoiceChips
          options={THICKNESS}
          value={thicknessName(shape.thickness)}
          onChange={(name) => onChange({ thickness: THICKNESS_VALUE[name] })}
        />
      </Section>
      {shape.shape === 'arrow' ? (
        <Section title="Direction">
          <ChoiceChips options={DIRECTIONS} value={shape.direction} onChange={turnTo} />
        </Section>
      ) : null}
      {shape.shape === 'line' ? (
        <Section title="Direction">
          <ChoiceChips
            options={LINE_DIRECTIONS}
            value={isHorizontal(shape.direction) ? 'right' : 'down'}
            onChange={turnTo}
          />
        </Section>
      ) : null}
      <View className="flex-row gap-2">
        <Button
          size="sm"
          variant="secondary"
          icon="remove"
          label="Smaller"
          onPress={() => resize(1 / GROW)}
        />
        <Button
          size="sm"
          variant="secondary"
          icon="add"
          label="Larger"
          onPress={() => resize(GROW)}
        />
      </View>
      <View className="flex-row gap-2">
        <Button
          className="flex-1"
          variant="secondary"
          icon="add-circle-outline"
          label="Add another"
          onPress={() => onAdd(shape.shape)}
        />
        <Button
          className="flex-1"
          variant="danger"
          icon="trash-outline"
          label="Remove"
          onPress={onDelete}
        />
      </View>
    </View>
  );
}

const LOGO_STYLES = [
  { value: 'solid', label: 'Solid' },
  { value: 'watermark', label: 'Watermark' },
] as const satisfies readonly { value: LogoStyle; label: string }[];

const CORNERS = [
  { value: 'top-right', label: 'Top right' },
  { value: 'top-left', label: 'Top left' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-left', label: 'Bottom left' },
] as const satisfies readonly { value: LogoPosition; label: string }[];

// A solid logo in the middle would hide the picture, so only a watermark can go there.
const WATERMARK_POSITIONS = [{ value: 'center', label: 'Centre' }, ...CORNERS] as const;

const LOGO_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
] as const satisfies readonly { value: LogoSize; label: string }[];

type LogoPanelProps = {
  logo: LogoSetting;
  onChange: (logo: LogoSetting) => void;
};

export function LogoPanel({ logo, onChange }: LogoPanelProps) {
  const watermark = logo.style === 'watermark';
  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between rounded-xl border border-border px-4 py-3">
        <Text className="text-base font-medium text-foreground">Add school logo</Text>
        <Switch
          value={logo.enabled}
          onValueChange={(enabled) => onChange({ ...logo, enabled })}
          trackColor={{ true: brand.blue, false: ui.border }}
          thumbColor="#FFFFFF"
        />
      </View>
      {logo.enabled ? (
        <>
          <Section
            title="Style"
            hint={watermark ? 'Semi-transparent, so the picture shows through.' : undefined}>
            <ChoiceChips
              options={LOGO_STYLES}
              value={logo.style}
              onChange={(style) => onChange(withLogoStyle(logo, style))}
            />
          </Section>
          <Section title="Position">
            <ChoiceChips
              options={watermark ? WATERMARK_POSITIONS : CORNERS}
              value={logo.position}
              onChange={(position) => onChange({ ...logo, position })}
            />
          </Section>
          <Section title="Size">
            <ChoiceChips
              options={LOGO_SIZES}
              value={logo.size}
              onChange={(size) => onChange({ ...logo, size })}
            />
          </Section>
        </>
      ) : null}
    </View>
  );
}
