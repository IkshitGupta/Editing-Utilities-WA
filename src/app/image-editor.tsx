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
import { exportPhoto, editedSize, loadSkImage } from '@/features/image-editor/draw-photo';
import { clampCrop } from '@/features/image-editor/geometry';
import { CropPanel, SizePanel } from '@/features/image-editor/panels';
import {
  PhotoCanvas,
  type CanvasMode,
  type CropChange,
} from '@/features/image-editor/photo-canvas';
import type { ImageEdit } from '@/features/image-editor/types';
import { saveToAlbum } from '@/features/media/album';
import { prepareImage } from '@/features/media/prepare-image';
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
    output: previous?.output ?? 'whatsapp',
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

  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [edit, setEdit] = useState<ImageEdit>(() => freshEdit());
  const [tool, setTool] = useState<Tool>('crop');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const saved = useRef<MediaItem[]>([]);

  const currentUri = items[index]?.uri;
  const image = loaded?.uri === currentUri ? loaded.image : null;
  const loadError = loaded?.uri === currentUri ? loaded.error : null;

  useEffect(() => {
    if (!currentUri) {
      return;
    }
    let cancelled = false;
    prepareImage(currentUri)
      .then((prepared) => loadSkImage(prepared.uri))
      .then(
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
  }, [currentUri]);

  // Frees the decoded photo as soon as the editor moves on from it.
  useEffect(() => () => image?.dispose(), [image]);

  if (items.length === 0) {
    return (
      <EmptyState title="No photos to edit" message="Go back and choose some photos." showBack />
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
  const remaining = items.length - index;

  const finish = () => {
    if (saved.current.length === 0) {
      router.back();
      return;
    }
    router.replace({ pathname: '/saved', params: { transfer: putTransfer(saved.current) } });
  };

  const goNext = () => {
    if (index + 1 >= items.length) {
      finish();
      return;
    }
    setIndex(index + 1);
    setEdit((previous) => freshEdit(previous));
    setSelectedId(null);
    setTool('crop');
  };

  const saveCurrent = async () => {
    if (!image) {
      return;
    }
    setBusy({ title: 'Saving photo…', progress: null });
    try {
      await waitForPaint();
      saved.current.push(await saveToAlbum(exportPhoto(image, edit, assets)));
      goNext();
    } catch (error) {
      Alert.alert('Could not save this photo', errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  // Saves this photo as edited, then gives every remaining photo the same shape, logo and size.
  const saveAllRemaining = async () => {
    if (!image) {
      return;
    }
    const later = freshEdit(edit);
    setBusy({ title: `Saving ${plural(remaining, 'photo')}…`, progress: 0 });
    try {
      await waitForPaint();
      saved.current.push(await saveToAlbum(exportPhoto(image, edit, assets)));
      for (let position = index + 1; position < items.length; position += 1) {
        setBusy({
          title: `Saving ${plural(remaining, 'photo')}…`,
          progress: ((position - index) / remaining) * 100,
        });
        await waitForPaint();
        const prepared = await prepareImage(items[position].uri);
        const next = await loadSkImage(prepared.uri);
        try {
          saved.current.push(await saveToAlbum(exportPhoto(next, later, assets)));
        } finally {
          next.dispose();
        }
      }
      finish();
    } catch (error) {
      Alert.alert('Could not save every photo', errorMessage(error));
    } finally {
      setBusy(null);
    }
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
            hint="Tap a text on the photo to change it. Drag it to move it and pinch to resize it."
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
          <View className="flex-1 items-center justify-center gap-3 bg-surface px-8">
            <Text className="text-center text-base text-foreground">{loadError}</Text>
            <Button variant="secondary" label="Skip this photo" onPress={goNext} />
          </View>
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
          {items.length > 1 ? <Button variant="secondary" label="Skip" onPress={goNext} /> : null}
          <Button
            className="flex-1"
            icon="checkmark"
            label={remaining > 1 ? 'Save and next' : 'Save photo'}
            disabled={!image}
            onPress={saveCurrent}
          />
        </View>
        {remaining > 1 ? (
          <View className="items-center">
            <Button
              size="sm"
              variant="ghost"
              icon="albums-outline"
              label={`Save all ${remaining} photos this way`}
              disabled={!image}
              onPress={saveAllRemaining}
            />
            <Text className="text-xs text-muted">
              The rest get this photo&apos;s shape, logo and size.
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
