import type { SkImage } from '@shopify/react-native-skia';
import { Stack, router, useLocalSearchParams } from 'expo-router';
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

import { BusyModal } from '@/components/busy-modal';
import { EmptyState } from '@/components/empty-state';
import { ToolTabs, type ToolTab } from '@/components/tool-tabs';
import { Button } from '@/components/ui/button';
import { exportPhoto, editedSize, loadEditablePhoto } from '@/features/image-editor/draw-photo';
import { clampCrop } from '@/features/image-editor/geometry';
import { CropPanel, SizePanel } from '@/features/image-editor/panels';
import {
  PhotoCanvas,
  type CanvasMode,
  type CropChange,
} from '@/features/image-editor/photo-canvas';
import type { ImageEdit } from '@/features/image-editor/types';
import { saveToAlbum } from '@/features/media/album';
import type { MediaItem } from '@/features/media/types';
import { useLogoImage, useOverlayFonts } from '@/features/overlays/assets';
import { applyOverlayChange, type OverlayChange } from '@/features/overlays/layout';
import { LogoPanel, ShapePanel, TextPanel } from '@/features/overlays/panels';
import {
  DEFAULT_LOGO,
  newShapeOverlay,
  newTextOverlay,
  type Overlay,
  type ShapeKind,
  type ShapeOverlay,
  type TextOverlay,
} from '@/features/overlays/types';
import { errorMessage } from '@/lib/errors';
import { deleteTemporaryFile } from '@/lib/files';
import { plural } from '@/lib/format';
import { putTransfer, readTransfer } from '@/lib/transfer';
import { waitForPaint } from '@/lib/utils';
import { brand } from '@/theme/colors';

type Tool = 'crop' | 'text' | 'shapes' | 'logo' | 'size';

const TOOLS: readonly ToolTab<Tool>[] = [
  { value: 'crop', label: 'Crop', icon: 'crop' },
  { value: 'text', label: 'Text', icon: 'text' },
  { value: 'shapes', label: 'Shapes', icon: 'shapes-outline' },
  { value: 'logo', label: 'Logo', icon: 'ribbon-outline' },
  { value: 'size', label: 'Size', icon: 'resize' },
];

const CANVAS_MODE: Record<Tool, CanvasMode> = {
  crop: 'crop',
  text: 'text',
  shapes: 'shape',
  logo: 'view',
  size: 'view',
};

// The shape, logo and size carry over to the next photo; crop, rotation and text do not.
function freshEdit(previous?: ImageEdit): ImageEdit {
  return {
    rotation: 0,
    flipX: false,
    zoom: 1,
    panX: 0,
    panY: 0,
    shape: previous?.shape ?? 'original',
    overlays: [],
    logo: previous?.logo ?? DEFAULT_LOGO,
    output: previous?.output ?? 'original',
  };
}

type Loaded = { uri: string; image: SkImage | null; error: string | null };
type Busy = { title: string; progress: number | null };

export default function ImageEditorScreen() {
  const params = useLocalSearchParams<{ transfer?: string }>();
  const items = readTransfer<MediaItem[]>(params.transfer) ?? [];
  const insets = useSafeAreaInsets();
  const fonts = useOverlayFonts();
  const logo = useLogoImage();
  const assets = { fonts, logo };

  // Positions in `items` still to edit, in order; the first one is on screen. After "Save all",
  // only the photos that could not be saved remain, so trying again never saves one twice.
  const [pending, setPending] = useState<number[]>(() => items.map((_, position) => position));
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // Raised by "Try again" to load the photo on screen once more.
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [edit, setEdit] = useState<ImageEdit>(() => freshEdit());
  const [tool, setTool] = useState<Tool>('crop');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const saved = useRef<MediaItem[]>([]);
  // Blocks a second save from a quick double tap before the busy screen appears.
  const saving = useRef(false);

  const index = pending[0] ?? 0;
  const currentUri = items[index]?.uri;
  const image = loaded?.uri === currentUri ? loaded.image : null;
  const loadError = loaded?.uri === currentUri ? loaded.error : null;

  useEffect(() => {
    if (!currentUri) {
      return;
    }
    let cancelled = false;
    loadEditablePhoto(currentUri).then(
      (result) => {
        if (!cancelled) {
          setLoaded({ uri: currentUri, image: result, error: null });
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setLoaded({ uri: currentUri, image: null, error: errorMessage(error) });
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [currentUri, loadAttempt]);

  // Frees the decoded photo as soon as the editor moves on from it.
  useEffect(() => () => image?.dispose(), [image]);

  // The picker's copies of the chosen photos are only needed while this screen is open.
  useEffect(() => {
    const picked = readTransfer<MediaItem[]>(params.transfer) ?? [];
    return () => picked.forEach((item) => deleteTemporaryFile(item.uri));
  }, [params.transfer]);

  if (items.length === 0) {
    return (
      <EmptyState
        title="No photos selected"
        message="Go back and select photos to edit."
        showBack
      />
    );
  }

  const sourceSize = image ? { width: image.width(), height: image.height() } : null;
  const updateEdit = (patch: Partial<ImageEdit>) =>
    setEdit((previous) => {
      const next = { ...previous, ...patch };
      return sourceSize ? clampCrop(sourceSize, next) : next;
    });

  const cropBy = (change: CropChange) =>
    setEdit((previous) =>
      sourceSize
        ? clampCrop(sourceSize, {
            ...previous,
            panX: previous.panX + change.panX,
            panY: previous.panY + change.panY,
            zoom: previous.zoom * change.zoom,
          })
        : previous
    );

  const changeOverlay = (id: string, change: OverlayChange) =>
    setEdit((previous) => ({
      ...previous,
      overlays: previous.overlays.map((overlay) =>
        overlay.id === id ? applyOverlayChange(overlay, change) : overlay
      ),
    }));

  const updateOverlay = (id: string, patch: Partial<TextOverlay> | Partial<ShapeOverlay>) =>
    setEdit((previous) => ({
      ...previous,
      overlays: previous.overlays.map((overlay) =>
        overlay.id === id ? ({ ...overlay, ...patch } as Overlay) : overlay
      ),
    }));

  const addOverlay = (overlay: Overlay) => {
    setEdit((previous) => ({ ...previous, overlays: [...previous.overlays, overlay] }));
    setSelectedId(overlay.id);
  };

  const removeSelected = () => {
    setEdit((previous) => ({
      ...previous,
      overlays: previous.overlays.filter((overlay) => overlay.id !== selectedId),
    }));
    setSelectedId(null);
  };

  const selected = edit.overlays.find((overlay) => overlay.id === selectedId) ?? null;
  const remaining = pending.length;

  const finish = () => {
    if (saved.current.length === 0) {
      router.back();
      return;
    }
    router.replace({ pathname: '/saved', params: { transfer: putTransfer(saved.current) } });
  };

  const goNext = () => {
    if (pending.length <= 1) {
      finish();
      return;
    }
    setPending(pending.slice(1));
    setEdit((previous) => freshEdit(previous));
    setSelectedId(null);
    setTool('crop');
  };

  const skip = () => {
    if (!saving.current) {
      goNext();
    }
  };

  const retryLoad = () => {
    setLoaded(null);
    setLoadAttempt((attempt) => attempt + 1);
  };

  const saveCurrent = async () => {
    if (!image || saving.current) {
      return;
    }
    saving.current = true;
    setBusy({ title: 'Saving photo…', progress: null });
    try {
      await waitForPaint();
      saved.current.push(await saveToAlbum(exportPhoto(image, edit, assets)));
      goNext();
    } catch (error) {
      Alert.alert('Could not save this photo', errorMessage(error));
    } finally {
      setBusy(null);
      saving.current = false;
    }
  };

  // Saves this photo as edited, then gives every remaining photo the same shape, logo and size.
  // Photos that can't be saved stay open to try again; the others are never saved twice.
  const saveAllRemaining = async () => {
    if (!image || saving.current) {
      return;
    }
    saving.current = true;
    const later = freshEdit(edit);
    const queue = pending;
    const title = `Saving ${plural(queue.length, 'photo')}…`;
    const failed: number[] = [];
    let firstError = '';
    try {
      for (let step = 0; step < queue.length; step += 1) {
        setBusy({ title, progress: (step / queue.length) * 100 });
        await waitForPaint();
        try {
          if (step === 0) {
            saved.current.push(await saveToAlbum(exportPhoto(image, edit, assets)));
          } else {
            const next = await loadEditablePhoto(items[queue[step]].uri);
            try {
              saved.current.push(await saveToAlbum(exportPhoto(next, later, assets)));
            } finally {
              next.dispose();
            }
          }
        } catch (error) {
          failed.push(queue[step]);
          const message = errorMessage(error);
          firstError ||= message;
        }
      }
    } finally {
      setBusy(null);
      saving.current = false;
    }
    if (failed.length === 0) {
      finish();
      return;
    }
    // The photo on screen keeps its own edits if it failed; a later photo opens with the shape,
    // logo and size "Save all" gave it.
    if (failed[0] !== queue[0]) {
      setEdit(later);
      setSelectedId(null);
      setTool('crop');
    }
    setPending(failed);
    Alert.alert(
      `Could not save ${plural(failed.length, 'photo')}`,
      `${failed.length === 1 ? 'The photo is' : 'These photos are'} still open, so you can try again.\n\n${firstError}`
    );
  };

  const changeTool = (next: Tool) => {
    setTool(next);
    setSelectedId(null);
  };

  const panel = (() => {
    switch (tool) {
      case 'crop':
        return <CropPanel edit={edit} onChange={updateEdit} />;
      case 'text':
        return (
          <TextPanel
            overlay={selected?.kind === 'text' ? selected : null}
            onAdd={() => addOverlay(newTextOverlay())}
            onChange={(patch) => selectedId && updateOverlay(selectedId, patch)}
            onDelete={removeSelected}
            hint="Tap text on the photo to edit it. Drag to move it and pinch to resize it."
            note="The dashed outline marks the selected text and is not saved."
          />
        );
      case 'shapes':
        return (
          <ShapePanel
            shape={selected?.kind === 'shape' ? selected : null}
            onAdd={(kind: ShapeKind) => addOverlay(newShapeOverlay(kind))}
            onChange={(patch) => selectedId && updateOverlay(selectedId, patch)}
            onDelete={removeSelected}
          />
        );
      case 'logo':
        return (
          <LogoPanel logo={edit.logo} onChange={(nextLogo) => updateEdit({ logo: nextLogo })} />
        );
      case 'size':
        return (
          <SizePanel
            edit={edit}
            onChange={updateEdit}
            resultSize={image ? editedSize(image, edit) : null}
          />
        );
    }
  })();

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: items.length > 1 ? `Photo ${index + 1} of ${items.length}` : 'Edit photo',
        }}
      />
      <View className="flex-1">
        {image ? (
          <PhotoCanvas
            image={image}
            edit={edit}
            mode={CANVAS_MODE[tool]}
            selectedId={selectedId}
            assets={assets}
            onCropChange={cropBy}
            onSelect={setSelectedId}
            onOverlayChange={changeOverlay}
          />
        ) : loadError ? (
          <ScrollView
            className="flex-1 bg-surface"
            contentContainerClassName="flex-grow items-center justify-center gap-3 px-8 py-6">
            <Text className="text-center text-base text-foreground" numberOfLines={4}>
              {loadError}
            </Text>
            <Button label="Try again" onPress={retryLoad} />
            <Button variant="secondary" label="Skip this photo" onPress={skip} />
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center bg-surface">
            <ActivityIndicator size="large" color={brand.blue} />
          </View>
        )}
      </View>
      <ScrollView
        className="max-h-[42%]"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="p-4">
        {panel}
      </ScrollView>
      <ToolTabs tabs={TOOLS} value={tool} onChange={changeTool} />
      <View
        className="gap-2 border-t border-border px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}>
        <View className="flex-row gap-2">
          {items.length > 1 ? <Button variant="secondary" label="Skip" onPress={skip} /> : null}
          <Button
            className="flex-1"
            icon="checkmark"
            label={remaining > 1 ? 'Save and next' : 'Save photo'}
            disabled={!image || busy !== null}
            onPress={saveCurrent}
          />
        </View>
        {remaining > 1 ? (
          <View className="items-center">
            <Button
              size="sm"
              variant="ghost"
              icon="albums-outline"
              label={`Save all ${remaining} photos`}
              disabled={!image || busy !== null}
              onPress={saveAllRemaining}
            />
            <Text className="text-xs text-muted">
              Applies this photo&apos;s shape, logo and size to the rest.
            </Text>
          </View>
        ) : null}
      </View>
      <BusyModal
        visible={busy !== null}
        title={busy?.title ?? ''}
        progress={busy?.progress ?? null}
      />
    </KeyboardAvoidingView>
  );
}
