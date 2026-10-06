import * as DocumentPicker from 'expo-document-picker';
import { useEventListener } from 'expo';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer } from 'expo-video';
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
import { exportPhoto } from '@/features/image-editor/draw-photo';
import type { ImageEdit, Rotation } from '@/features/image-editor/types';
import { saveToAlbum } from '@/features/media/album';
import { pickMedia } from '@/features/media/picker';
import type { MediaItem } from '@/features/media/types';
import { useLogoImage, useOverlayFonts } from '@/features/overlays/assets';
import { LogoPanel, TextPanel } from '@/features/overlays/panels';
import { DEFAULT_LOGO, newTextOverlay } from '@/features/overlays/types';
import {
  clipThumbnails,
  loadClip,
  loadFrame,
  renderOverlayLayer,
} from '@/features/video-editor/clips';
import {
  buildRenderSpec,
  outputSizeFor,
  renderSpecSchema,
  trimClip,
  trimmedDurationMs,
  type VideoClip,
  type VideoEdit,
} from '@/features/video-editor/edit-list';
import { useMusicPreview } from '@/features/video-editor/music-preview';
import { ClipsPanel, SoundPanel, VideoShapePanel } from '@/features/video-editor/panels';
import { configurePlayer, currentTimeMs, seekTo } from '@/features/video-editor/player-control';
import { TrimBar } from '@/features/video-editor/trim-bar';
import { musicFileUri } from '@/features/video-editor/tunes';
import { VideoPreview } from '@/features/video-editor/video-preview';
import { errorCode, errorMessage } from '@/lib/errors';
import { deleteTemporaryFile, outputName } from '@/lib/files';
import { putTransfer, readTransfer } from '@/lib/transfer';
import { clamp, waitForPaint } from '@/lib/utils';
import { brand } from '@/theme/colors';

type Tool = 'trim' | 'shape' | 'sound' | 'text' | 'clips';

const TOOLS: readonly ToolTab<Tool>[] = [
  { value: 'trim', label: 'Trim', icon: 'cut-outline' },
  { value: 'shape', label: 'Shape', icon: 'crop' },
  { value: 'sound', label: 'Sound', icon: 'musical-notes-outline' },
  { value: 'text', label: 'Logo & text', icon: 'text' },
  { value: 'clips', label: 'Clips', icon: 'film-outline' },
];

const CAPTION_PLACES = [
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Centre' },
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
    return `This phone could not process the video.\n\nDetails: ${errorMessage(error)}`;
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
  // Follows the player as soon as it reports a change, before the screen updates, so the end of
  // playback can be told apart from reaching the end while paused.
  const playingNow = useRef(false);
  const [busy, setBusy] = useState<Busy | null>(null);
  const thumbnailsRequested = useRef(new Set<string>());
  // Strips are made one clip at a time, which keeps memory low with several large videos.
  const stripQueue = useRef<Promise<void>>(Promise.resolve());
  // Working copies made while editing: the picker's copies of the clips, music and strip frames.
  const workingFiles = useRef(new Set<string>());
  const screen = useRef({ closed: false });
  // Blocks a second save from a quick double tap before the busy screen appears.
  const saving = useRef(false);
  // Cancel can be tapped before the phone starts encoding, when there is nothing native to stop.
  const cancelRequested = useRef(false);

  const items = readTransfer<MediaItem[]>(transferId) ?? [];

  useEffect(() => {
    const picked = readTransfer<MediaItem[]>(transferId) ?? [];
    if (picked.length === 0) {
      return;
    }
    picked.forEach((item) => workingFiles.current.add(item.uri));
    let cancelled = false;
    Promise.all(picked.map(loadClip)).then((loaded) => {
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

  useEffect(() => {
    const files = workingFiles.current;
    const state = screen.current;
    return () => {
      state.closed = true;
      files.forEach((uri) => deleteTemporaryFile(uri));
    };
  }, []);

  const clips = edit?.clips;
  useEffect(() => {
    clips?.forEach((clip) => {
      if (thumbnailsRequested.current.has(clip.id)) {
        return;
      }
      thumbnailsRequested.current.add(clip.id);
      stripQueue.current = stripQueue.current
        .then(() => (screen.current.closed ? [] : clipThumbnails(clip)))
        .then((uris) => {
          if (screen.current.closed) {
            uris.forEach((uri) => deleteTemporaryFile(uri));
            return;
          }
          uris.forEach((uri) => workingFiles.current.add(uri));
          setThumbnails((previous) => ({ ...previous, [clip.id]: uris }));
        })
        .catch(() => undefined);
    });
  }, [clips]);

  const activeClip = edit?.clips.find((clip) => clip.id === activeId) ?? edit?.clips[0] ?? null;
  const player = useVideoPlayer(activeClip?.uri ?? null, configurePlayer);
  const musicPreview = useMusicPreview(player, edit, activeClip);

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    playingNow.current = isPlaying;
    setPlaying(isPlaying);
  });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const ms = currentTime * 1000;
    setPositionMs(ms);
    // Playback stops at the trim end so the preview matches the saved video.
    if (activeClip && playing && ms >= activeClip.endMs - 60) {
      player.pause();
      seekTo(player, activeClip.startMs);
    }
  });
  // Reaching the end of the file pauses the player, so a later tap on the frame strip only moves
  // the preview. After playback the preview returns to the trim start, as it does at the trim end.
  useEventListener(player, 'playToEnd', () => {
    const afterPlayback = playingNow.current;
    player.pause();
    if (activeClip && afterPlayback) {
      seekTo(player, activeClip.startMs);
    }
  });

  // A selection that no longer exists, for example after Android closed the app, has nothing to open.
  if (!transferId || loadError || (!edit && items.length === 0)) {
    return (
      <EmptyState
        title={loadError ?? 'No video selected'}
        message="Go back and select a video to edit."
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
    // The clip opens in a new player, which starts paused; the old player's pause goes unreported.
    playingNow.current = false;
    setPlaying(false);
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
    workingFiles.current.add(song.uri);
    updateEdit({ sound: 'music', music: { kind: 'file', uri: song.uri, name: song.name } });
  };

  const addClips = async () => {
    const picked = await pickMedia({ kinds: ['video'], multiple: true, limit: 10 });
    if (picked.length === 0) {
      return;
    }
    picked.forEach((item) => workingFiles.current.add(item.uri));
    const loaded = (await Promise.all(picked.map(loadClip))).filter((clip) => clip.durationMs > 0);
    setEdit((previous) =>
      previous ? { ...previous, clips: [...previous.clips, ...loaded] } : previous
    );
  };

  const saveVideo = async () => {
    if (saving.current) {
      return;
    }
    saving.current = true;
    cancelRequested.current = false;
    player.pause();
    musicPreview.stopListening();
    setBusy({ title: 'Saving video…', progress: 0, cancellable: true });
    const subscription = SchoolMedia.addListener('onRenderProgress', ({ progress }) =>
      setBusy((current) => (current ? { ...current, progress } : current))
    );
    let overlayUri: string | null = null;
    try {
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      await waitForPaint();
      const chosenMusic = edit.sound === 'music' ? edit.music : null;
      const musicUri = chosenMusic ? await musicFileUri(chosenMusic) : null;
      overlayUri = renderOverlayLayer(edit, outputSizeFor(edit), assets);
      const spec = renderSpecSchema.parse({
        ...buildRenderSpec(edit, overlayUri, musicUri),
        fileName: outputName('mp4'),
      });
      if (cancelRequested.current) {
        return;
      }
      const result = await SchoolMedia.renderVideo(spec);
      setBusy({ title: 'Adding to the album…', progress: null, cancellable: false });
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
      deleteTemporaryFile(overlayUri);
      subscription.remove();
      deactivateKeepAwake(KEEP_AWAKE_TAG);
      setBusy(null);
      saving.current = false;
    }
  };

  const cancelSave = () => {
    cancelRequested.current = true;
    SchoolMedia.cancelRender();
  };

  const saveThumbnail = async () => {
    if (saving.current) {
      return;
    }
    saving.current = true;
    player.pause();
    const time = Math.round(clamp(currentTimeMs(player), activeClip.startMs, activeClip.endMs));
    // After playback the picture can be a few frames away from the position, so the preview moves
    // to the frame being saved. The player skips a seek to the millisecond it is already at, so it
    // first steps 1 ms away.
    seekTo(player, time > activeClip.startMs ? time - 1 : time + 1);
    seekTo(player, time);
    setBusy({ title: 'Saving thumbnail…', progress: null, cancellable: false });
    try {
      await waitForPaint();
      const image = await loadFrame(activeClip, time);
      try {
        // Some phones return frames still turned sideways; match the shape the video shows.
        const frameIsPortrait = image.height() > image.width();
        const videoIsPortrait = activeClip.height > activeClip.width;
        const correction = frameIsPortrait === videoIsPortrait ? 0 : 90;
        const caption = edit.caption;
        const thumbnail: ImageEdit = {
          rotation: ((edit.rotation + correction) % 360) as Rotation,
          flipX: false,
          shape: 'landscape',
          zoom: 1,
          panX: 0,
          panY: 0,
          overlays: caption && caption.text.trim() ? [caption] : [],
          logo: edit.logo,
          output: 'yt-thumbnail',
        };
        await saveToAlbum(exportPhoto(image, thumbnail, assets));
      } finally {
        image.dispose();
      }
      Alert.alert('Thumbnail saved', 'Saved to the School Admin album.');
    } catch (error) {
      Alert.alert('Could not save the thumbnail', errorMessage(error));
    } finally {
      setBusy(null);
      saving.current = false;
    }
  };

  const changeTool = (next: Tool) => {
    musicPreview.stopListening();
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
            <Text className="text-sm text-muted">Drag the handles to set the start and end.</Text>
            <Button
              variant="secondary"
              icon="image-outline"
              label="Save frame as thumbnail"
              onPress={saveThumbnail}
            />
            <Text className="text-sm text-muted">
              Saves the current frame as a 1280 × 720 YouTube thumbnail, with the logo and caption.
            </Text>
          </View>
        );
      case 'shape':
        return <VideoShapePanel edit={edit} onChange={updateEdit} activeClip={activeClip} />;
      case 'sound':
        return (
          <SoundPanel
            edit={edit}
            onChange={updateEdit}
            listeningTo={musicPreview.listeningTo}
            onListen={musicPreview.listen}
            onStopListening={musicPreview.stopListening}
            onPickMusic={pickMusic}
          />
        );
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
                hint="For example, the event name and date."
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
        <Button
          size="lg"
          icon="checkmark"
          label="Save video"
          disabled={busy !== null}
          onPress={saveVideo}
        />
      </View>
      <BusyModal
        visible={busy !== null}
        title={busy?.title ?? ''}
        message={
          busy?.cancellable ? 'Keep the app open. Long videos can take several minutes.' : undefined
        }
        progress={busy?.progress ?? null}
        onCancel={busy?.cancellable ? cancelSave : undefined}
      />
    </KeyboardAvoidingView>
  );
}
