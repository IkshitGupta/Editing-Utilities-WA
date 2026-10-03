import * as DocumentPicker from 'expo-document-picker';
import { useEventListener } from 'expo';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ZodError } from 'zod';

import SchoolMedia from '@modules/school-media';

import { BusyModal } from '@/components/busy-modal';
import { EmptyState } from '@/components/empty-state';
import { ToolTabs, type ToolTab } from '@/components/tool-tabs';
import { Button } from '@/components/ui/button';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { Section } from '@/components/ui/section';
import { exportPhoto, loadSkImage } from '@/features/image-editor/draw-photo';
import type { ImageEdit, Rotation } from '@/features/image-editor/types';
import { saveToAlbum } from '@/features/media/album';
import { pickMedia } from '@/features/media/picker';
import type { MediaItem } from '@/features/media/types';
import { useLogoImage, useOverlayFonts } from '@/features/overlays/assets';
import { LogoPanel, TextPanel } from '@/features/overlays/panels';
import { DEFAULT_LOGO, newTextOverlay } from '@/features/overlays/types';
import { clipThumbnails, loadClip, renderOverlayLayer } from '@/features/video-editor/clips';
import {
  buildRenderSpec,
  outputSizeFor,
  renderSpecSchema,
  trimClip,
  trimmedDurationMs,
  type VideoClip,
  type VideoEdit,
} from '@/features/video-editor/edit-list';
import {
  ClipsPanel,
  OutputPanel,
  SoundPanel,
  VideoShapePanel,
} from '@/features/video-editor/panels';
import { configurePlayer, seekTo, setMuted } from '@/features/video-editor/player-control';
import { TrimBar } from '@/features/video-editor/trim-bar';
import { VideoPreview } from '@/features/video-editor/video-preview';
import { errorCode, errorMessage } from '@/lib/errors';
import { putTransfer, readTransfer } from '@/lib/transfer';
import { clamp, waitForPaint } from '@/lib/utils';
import { brand } from '@/theme/colors';

type Tool = 'trim' | 'shape' | 'sound' | 'text' | 'clips' | 'size';

const TOOLS: readonly ToolTab<Tool>[] = [
  { value: 'trim', label: 'Trim', icon: 'cut-outline' },
  { value: 'shape', label: 'Shape', icon: 'crop' },
  { value: 'sound', label: 'Sound', icon: 'musical-notes-outline' },
  { value: 'text', label: 'Logo, text', icon: 'text' },
  { value: 'clips', label: 'Clips', icon: 'film-outline' },
  { value: 'size', label: 'Size', icon: 'resize' },
];

const CAPTION_PLACES = [
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' },
] as const;

const CAPTION_Y = { top: 0.12, middle: 0.5, bottom: 0.88 } as const;

const KEEP_AWAKE_TAG = 'video-render';

function initialEdit(clips: VideoClip[]): VideoEdit {
  return {
    clips,
    rotation: 0,
    shape: 'original',
    position: 0,
    sound: 'original',
    music: null,
    musicVolume: 0.6,
    mixOriginal: false,
    preset: 'whatsapp',
    logo: DEFAULT_LOGO,
    caption: null,
  };
}

function captionPlace(y: number): keyof typeof CAPTION_Y {
  if (y < 0.3) {
    return 'top';
  }
  return y > 0.7 ? 'bottom' : 'middle';
}

function renderErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? 'Some video settings are not valid.';
  }
  if (errorCode(error) === 'ERR_RENDER_FAILED') {
    return `This phone could not make the video. Try the WhatsApp size or a shorter clip.\n\n(${errorMessage(error)})`;
  }
  return errorMessage(error);
}

type Busy = { title: string; progress: number | null; cancellable: boolean };

export default function VideoEditorScreen() {
  const params = useLocalSearchParams<{ transfer?: string }>();
  const transferId = typeof params.transfer === 'string' ? params.transfer : '';
  const insets = useSafeAreaInsets();
  const fonts = useOverlayFonts();
  const logo = useLogoImage();
  const assets = { fonts, logo };

  const [edit, setEdit] = useState<VideoEdit | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string[]>>({});
  const [tool, setTool] = useState<Tool>('trim');
  const [positionMs, setPositionMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<Busy | null>(null);
  const thumbnailsRequested = useRef(new Set<string>());

  useEffect(() => {
    const items = readTransfer<MediaItem[]>(transferId) ?? [];
    if (items.length === 0) {
      return;
    }
    let cancelled = false;
    Promise.all(items.map(loadClip)).then((loaded) => {
      if (cancelled) {
        return;
      }
      const usable = loaded.filter((clip) => clip.durationMs > 0);
      if (usable.length === 0) {
        setLoadError('These videos could not be opened.');
        return;
      }
      setEdit(initialEdit(usable));
      setActiveId(usable[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, [transferId]);

  const clipKey = edit?.clips.map((clip) => clip.id).join('|') ?? '';
  useEffect(() => {
    edit?.clips.forEach((clip) => {
      if (thumbnailsRequested.current.has(clip.id)) {
        return;
      }
      thumbnailsRequested.current.add(clip.id);
      clipThumbnails(clip).then((uris) =>
        setThumbnails((previous) => ({ ...previous, [clip.id]: uris }))
      );
    });
    // Only new clips need thumbnails, so this runs when the list of clips changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipKey]);

  const activeClip = edit?.clips.find((clip) => clip.id === activeId) ?? edit?.clips[0] ?? null;
  const player = useVideoPlayer(activeClip?.uri ?? null, configurePlayer);

  useEffect(() => {
    setMuted(player, edit?.sound !== 'original');
  }, [player, edit?.sound]);

  useEventListener(player, 'playingChange', ({ isPlaying }) => setPlaying(isPlaying));
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const ms = currentTime * 1000;
    setPositionMs(ms);
    // Playback stops at the trim end so the preview matches the saved video.
    if (activeClip && playing && ms >= activeClip.endMs - 60) {
      player.pause();
      seekTo(player, activeClip.startMs);
    }
  });

  if (!transferId || loadError) {
    return (
      <EmptyState
        title={loadError ?? 'No video to edit'}
        message="Go back and choose a video."
        showBack
      />
    );
  }
  if (!edit || !activeClip) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-background">
        <ActivityIndicator size="large" color={brand.blue} />
        <Text className="text-base text-muted">Opening video…</Text>
      </View>
    );
  }

  const updateEdit = (patch: Partial<VideoEdit>) =>
    setEdit((previous) => (previous ? { ...previous, ...patch } : previous));

  const selectClip = (id: string) => {
    player.pause();
    setActiveId(id);
    setPositionMs(0);
  };

  const togglePlay = () => {
    if (playing) {
      player.pause();
      return;
    }
    if (positionMs < activeClip.startMs || positionMs >= activeClip.endMs - 100) {
      seekTo(player, activeClip.startMs);
    }
    player.play();
  };

  const onTrim = (handle: 'start' | 'end', deltaMs: number) => {
    const id = activeClip.id;
    setEdit((previous) =>
      previous
        ? {
            ...previous,
            clips: previous.clips.map((clip) =>
              clip.id === id ? trimClip(clip, handle, deltaMs) : clip
            ),
          }
        : previous
    );
    // The preview shows the frame at the moved handle, which makes the cut easy to place.
    const moved = trimClip(activeClip, handle, deltaMs);
    player.pause();
    seekTo(player, handle === 'start' ? moved.startMs : moved.endMs);
  };

  const pickMusic = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || result.assets.length === 0) {
      return;
    }
    const [song] = result.assets;
    updateEdit({ sound: 'music', music: { uri: song.uri, name: song.name } });
  };

  const addClips = async () => {
    const picked = await pickMedia({ kinds: ['video'], multiple: true, limit: 10 });
    if (picked.length === 0) {
      return;
    }
    const loaded = (await Promise.all(picked.map(loadClip))).filter((clip) => clip.durationMs > 0);
    setEdit((previous) =>
      previous ? { ...previous, clips: [...previous.clips, ...loaded] } : previous
    );
  };

  const saveVideo = async () => {
    player.pause();
    setBusy({ title: 'Saving video…', progress: 0, cancellable: true });
    const subscription = SchoolMedia.addListener('onRenderProgress', ({ progress }) =>
      setBusy((current) => (current ? { ...current, progress } : current))
    );
    try {
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      await waitForPaint();
      const overlayUri = renderOverlayLayer(edit, outputSizeFor(edit), assets);
      const spec = renderSpecSchema.parse(buildRenderSpec(edit, overlayUri));
      const result = await SchoolMedia.renderVideo(spec);
      setBusy({ title: 'Adding to the School Admin album…', progress: null, cancellable: false });
      const item = await saveToAlbum({
        uri: result.uri,
        kind: 'video',
        width: spec.width,
        height: spec.height,
        durationMs: result.durationMs || trimmedDurationMs(edit.clips),
      });
      router.replace({ pathname: '/saved', params: { transfer: putTransfer([item]) } });
    } catch (error) {
      if (errorCode(error) !== 'ERR_RENDER_CANCELLED') {
        Alert.alert('Could not save the video', renderErrorMessage(error));
      }
    } finally {
      subscription.remove();
      deactivateKeepAwake(KEEP_AWAKE_TAG);
      setBusy(null);
    }
  };

  const saveThumbnail = async () => {
    player.pause();
    setBusy({ title: 'Saving thumbnail…', progress: null, cancellable: false });
    try {
      await waitForPaint();
      const time = Math.round(clamp(positionMs, activeClip.startMs, activeClip.endMs));
      const frame = await VideoThumbnails.getThumbnailAsync(activeClip.uri, { time, quality: 1 });
      const image = await loadSkImage(frame.uri);
      try {
        // Some phones return frames still turned sideways; match the shape the video shows.
        const frameIsPortrait = image.height() > image.width();
        const videoIsPortrait = activeClip.height > activeClip.width;
        const correction = frameIsPortrait === videoIsPortrait ? 0 : 90;
        const thumbnail: ImageEdit = {
          rotation: ((edit.rotation + correction) % 360) as Rotation,
          flipX: false,
          shape: 'landscape',
          zoom: 1,
          panX: 0,
          panY: 0,
          overlays: edit.caption ? [edit.caption] : [],
          logo: edit.logo,
          output: 'yt-thumbnail',
        };
        await saveToAlbum(exportPhoto(image, thumbnail, assets));
      } finally {
        image.dispose();
      }
      Alert.alert('Thumbnail saved', 'It is in the School Admin album, ready to add on YouTube.');
    } catch (error) {
      Alert.alert('Could not save the thumbnail', errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const changeTool = (next: Tool) => {
    setTool(next);
  };

  const caption = edit.caption;
  const panel = (() => {
    switch (tool) {
      case 'trim':
        return (
          <View className="gap-3">
            {edit.clips.length > 1 ? (
              <ChoiceChips
                options={edit.clips.map((clip, index) => ({
                  value: clip.id,
                  label: `Clip ${index + 1}`,
                }))}
                value={activeClip.id}
                onChange={selectClip}
              />
            ) : null}
            <TrimBar
              clip={activeClip}
              thumbnails={thumbnails[activeClip.id] ?? []}
              positionMs={positionMs}
              onTrim={onTrim}
              onSeek={(ms) => seekTo(player, ms)}
            />
            <Text className="text-sm text-muted">
              Drag the yellow handles to choose the part to keep.
            </Text>
          </View>
        );
      case 'shape':
        return <VideoShapePanel edit={edit} onChange={updateEdit} activeClip={activeClip} />;
      case 'sound':
        return <SoundPanel edit={edit} onChange={updateEdit} onPickMusic={pickMusic} />;
      case 'text':
        return (
          <View className="gap-5">
            <LogoPanel logo={edit.logo} onChange={(nextLogo) => updateEdit({ logo: nextLogo })} />
            <Section title="Caption">
              <TextPanel
                overlay={caption}
                allowMultiple={false}
                onAdd={() => updateEdit({ caption: newTextOverlay({ y: CAPTION_Y.bottom }) })}
                onChange={(patch) => caption && updateEdit({ caption: { ...caption, ...patch } })}
                onDelete={() => updateEdit({ caption: null })}
                hint="Add a line of text, such as the event name and date."
              />
              {caption ? (
                <ChoiceChips
                  options={CAPTION_PLACES}
                  value={captionPlace(caption.y)}
                  onChange={(place) => updateEdit({ caption: { ...caption, y: CAPTION_Y[place] } })}
                />
              ) : null}
            </Section>
          </View>
        );
      case 'clips':
        return (
          <ClipsPanel
            edit={edit}
            onChange={updateEdit}
            activeId={activeClip.id}
            thumbnails={thumbnails}
            onSelect={selectClip}
            onAddClips={addClips}
          />
        );
      case 'size':
        return <OutputPanel edit={edit} onChange={updateEdit} onSaveThumbnail={saveThumbnail} />;
    }
  })();

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: edit.clips.length > 1 ? `Edit video (${edit.clips.length} clips)` : 'Edit video',
        }}
      />
      <VideoPreview
        player={player}
        clip={activeClip}
        edit={edit}
        assets={assets}
        playing={playing}
        onTogglePlay={togglePlay}
      />
      <ScrollView
        className="max-h-[42%]"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="p-4">
        {panel}
      </ScrollView>
      <ToolTabs tabs={TOOLS} value={tool} onChange={changeTool} />
      <View
        className="border-t border-border px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}>
        <Button size="lg" icon="checkmark" label="Save video" onPress={saveVideo} />
      </View>
      <BusyModal
        visible={busy !== null}
        title={busy?.title ?? ''}
        message={
          busy?.cancellable ? 'Keep the app open. Longer videos take a few minutes.' : undefined
        }
        progress={busy?.progress ?? null}
        onCancel={busy?.cancellable ? () => SchoolMedia.cancelRender() : undefined}
      />
    </KeyboardAvoidingView>
  );
}
