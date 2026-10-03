import { Image } from 'expo-image';
import { Pressable, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { Icon } from '@/components/ui/icon';
import { Section } from '@/components/ui/section';
import { rotateClockwise, rotateCounterClockwise } from '@/features/image-editor/geometry';
import { formatBytes, formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { brand, ui } from '@/theme/colors';

import {
  clipCrop,
  trimmedDurationMs,
  type SoundMode,
  type VideoClip,
  type VideoEdit,
} from './edit-list';
import {
  VIDEO_PRESETS,
  VIDEO_PRESET_ORDER,
  VIDEO_SHAPES,
  estimatedBytes,
  longestFittingSeconds,
  videoBitrate,
  type VideoPresetId,
  type VideoShapeId,
} from './presets';

type PanelProps = {
  edit: VideoEdit;
  onChange: (patch: Partial<VideoEdit>) => void;
};

const SHAPE_OPTIONS = (Object.keys(VIDEO_SHAPES) as VideoShapeId[]).map((id) => ({
  value: id,
  label: VIDEO_SHAPES[id].label,
}));

type Placement = 'start' | 'center' | 'end';
const PLACEMENT_VALUE: Record<Placement, number> = { start: -1, center: 0, end: 1 };

function placementOf(position: number): Placement {
  if (position < -0.33) {
    return 'start';
  }
  return position > 0.33 ? 'end' : 'center';
}

export function VideoShapePanel({
  edit,
  onChange,
  activeClip,
}: PanelProps & { activeClip: VideoClip }) {
  const crop = clipCrop(activeClip, edit);
  const cropsSides = crop.right - crop.left < 0.999;
  const cropsTopBottom = crop.bottom - crop.top < 0.999;
  const placements = cropsSides
    ? [
        { value: 'start' as const, label: 'Left' },
        { value: 'center' as const, label: 'Centre' },
        { value: 'end' as const, label: 'Right' },
      ]
    : [
        { value: 'start' as const, label: 'Top' },
        { value: 'center' as const, label: 'Centre' },
        { value: 'end' as const, label: 'Bottom' },
      ];
  const chooseShape = (shape: VideoShapeId) => {
    // Shorts are always tall, so another shape switches back to the YouTube size.
    const preset = edit.preset === 'shorts' && shape !== 'tall' ? 'youtube' : edit.preset;
    onChange({ shape, preset, position: 0 });
  };
  return (
    <View className="gap-4">
      <Section title="Shape">
        <ChoiceChips options={SHAPE_OPTIONS} value={edit.shape} onChange={chooseShape} />
      </Section>
      {cropsSides || cropsTopBottom ? (
        <Section title="Keep this part">
          <ChoiceChips
            options={placements}
            value={placementOf(edit.position)}
            onChange={(placement) => onChange({ position: PLACEMENT_VALUE[placement] })}
          />
        </Section>
      ) : null}
      <View className="flex-row gap-2">
        <Button
          size="sm"
          variant="secondary"
          icon="arrow-undo-outline"
          label="Turn left"
          onPress={() => onChange({ rotation: rotateCounterClockwise(edit.rotation) })}
        />
        <Button
          size="sm"
          variant="secondary"
          icon="arrow-redo-outline"
          label="Turn right"
          onPress={() => onChange({ rotation: rotateClockwise(edit.rotation) })}
        />
      </View>
      {edit.clips.length > 1 ? (
        <Text className="text-sm text-muted">
          Every clip is cropped to the same shape so the joined video fits together.
        </Text>
      ) : null}
    </View>
  );
}

const SOUND_OPTIONS = [
  { value: 'original', label: 'Keep sound', icon: 'volume-high-outline' },
  { value: 'mute', label: 'Mute', icon: 'volume-mute-outline' },
  { value: 'music', label: 'Add music', icon: 'musical-notes-outline' },
] as const satisfies readonly { value: SoundMode; label: string; icon: string }[];

const VOLUME_OPTIONS = [
  { value: '0.3', label: 'Soft' },
  { value: '0.6', label: 'Medium' },
  { value: '1', label: 'Loud' },
] as const;

function volumeKey(volume: number): (typeof VOLUME_OPTIONS)[number]['value'] {
  if (volume < 0.45) {
    return '0.3';
  }
  return volume < 0.8 ? '0.6' : '1';
}

type SoundPanelProps = PanelProps & {
  onPickMusic: () => void;
};

export function SoundPanel({ edit, onChange, onPickMusic }: SoundPanelProps) {
  const chooseSound = (sound: SoundMode) => {
    if (sound === 'music' && !edit.music) {
      onPickMusic();
      return;
    }
    onChange({ sound });
  };
  return (
    <View className="gap-4">
      <ChoiceChips options={SOUND_OPTIONS} value={edit.sound} onChange={chooseSound} />
      {edit.sound === 'music' && edit.music ? (
        <>
          <View className="flex-row items-center gap-3 rounded-xl border border-border px-4 py-3">
            <Icon name="musical-note" size={20} color={brand.magenta} />
            <Text className="flex-1 text-base text-foreground" numberOfLines={1}>
              {edit.music.name}
            </Text>
            <Button size="sm" variant="ghost" label="Change" onPress={onPickMusic} />
          </View>
          <Section title="Music volume">
            <ChoiceChips
              options={VOLUME_OPTIONS}
              value={volumeKey(edit.musicVolume)}
              onChange={(value) => onChange({ musicVolume: Number(value) })}
            />
          </Section>
          <View className="flex-row items-center justify-between rounded-xl border border-border px-4 py-3">
            <Text className="flex-1 pr-3 text-base text-foreground">
              Keep the video&apos;s own sound quietly
            </Text>
            <Switch
              value={edit.mixOriginal}
              onValueChange={(mixOriginal) => onChange({ mixOriginal })}
              trackColor={{ true: brand.blue, false: ui.border }}
              thumbColor="#FFFFFF"
            />
          </View>
          <Text className="text-sm text-muted">
            The music plays from the start and repeats until the video ends. You hear it in the
            saved video.
          </Text>
        </>
      ) : null}
    </View>
  );
}

type ClipsPanelProps = PanelProps & {
  activeId: string;
  thumbnails: Record<string, string[]>;
  onSelect: (id: string) => void;
  onAddClips: () => void;
};

export function ClipsPanel({
  edit,
  onChange,
  activeId,
  thumbnails,
  onSelect,
  onAddClips,
}: ClipsPanelProps) {
  const move = (index: number, by: number) => {
    const clips = [...edit.clips];
    const target = index + by;
    if (target < 0 || target >= clips.length) {
      return;
    }
    [clips[index], clips[target]] = [clips[target], clips[index]];
    onChange({ clips });
  };
  const remove = (id: string) => {
    const clips = edit.clips.filter((clip) => clip.id !== id);
    if (clips.length > 0) {
      onChange({ clips });
      if (id === activeId) {
        onSelect(clips[0].id);
      }
    }
  };
  return (
    <View className="gap-2">
      {edit.clips.map((clip, index) => {
        const active = clip.id === activeId;
        const frame = thumbnails[clip.id]?.[0];
        return (
          <Pressable
            key={clip.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(clip.id)}
            className={cn(
              'flex-row items-center gap-3 rounded-xl border p-2',
              active ? 'border-brand-blue bg-brand-blue/10' : 'border-border bg-background'
            )}>
            <View className="h-12 w-16 overflow-hidden rounded-lg bg-black">
              {frame ? (
                <Image source={{ uri: frame }} style={{ flex: 1 }} contentFit="cover" />
              ) : null}
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">Clip {index + 1}</Text>
              <Text className="text-sm text-muted">
                {formatDuration(clip.endMs - clip.startMs)}
              </Text>
            </View>
            {edit.clips.length > 1 ? (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  icon="arrow-up"
                  accessibilityLabel="Move up"
                  disabled={index === 0}
                  onPress={() => move(index, -1)}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  icon="arrow-down"
                  accessibilityLabel="Move down"
                  disabled={index === edit.clips.length - 1}
                  onPress={() => move(index, 1)}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  icon="close"
                  accessibilityLabel="Remove clip"
                  onPress={() => remove(clip.id)}
                />
              </>
            ) : null}
          </Pressable>
        );
      })}
      <Button variant="secondary" icon="add" label="Add another clip" onPress={onAddClips} />
      <Text className="text-sm text-muted">
        Clips are joined from top to bottom. Tap a clip to trim it.
      </Text>
    </View>
  );
}

type OutputPanelProps = PanelProps & {
  onSaveThumbnail: () => void;
};

export function OutputPanel({ edit, onChange, onSaveThumbnail }: OutputPanelProps) {
  const totalMs = trimmedDurationMs(edit.clips);
  const preset = VIDEO_PRESETS[edit.preset];
  const { bitrate, tooLong } = videoBitrate(preset, totalMs);
  const choose = (id: VideoPresetId) => {
    const next = VIDEO_PRESETS[id];
    onChange(next.shape ? { preset: id, shape: next.shape, position: 0 } : { preset: id });
  };
  const fittingSeconds = longestFittingSeconds(preset);
  return (
    <View className="gap-2">
      {VIDEO_PRESET_ORDER.map((id) => {
        const option = VIDEO_PRESETS[id];
        const selected = edit.preset === id;
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
              <Text className="text-base font-semibold text-foreground">{option.label}</Text>
              <Text className="text-sm text-muted">{option.hint}</Text>
            </View>
          </Pressable>
        );
      })}
      <Text className="pt-1 text-sm text-muted">
        {formatDuration(totalMs)} long, about {formatBytes(estimatedBytes(bitrate, totalMs))}.
      </Text>
      {tooLong && fittingSeconds ? (
        <Text className="text-sm text-danger">
          This video is long for WhatsApp. Trim it to under {formatDuration(fittingSeconds * 1000)}{' '}
          to keep it small and sharp.
        </Text>
      ) : null}
      <Button
        variant="secondary"
        icon="image-outline"
        label="Save this frame as a thumbnail"
        onPress={onSaveThumbnail}
      />
      <Text className="text-sm text-muted">
        Saves the paused frame as a 1280 × 720 picture with the logo and caption, ready for YouTube.
      </Text>
    </View>
  );
}
