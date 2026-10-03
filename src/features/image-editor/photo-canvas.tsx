import { Canvas, ClipOp, Picture, Skia, type SkImage } from '@shopify/react-native-skia';
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { drawOverlays, overlayAt, type OverlayAssets } from '@/features/overlays/draw';
import type { OverlayChange } from '@/features/overlays/layout';

import { dimOutside, drawPhoto } from './draw-photo';
import { cropWindow, fitRect, type Rect, type Size } from './geometry';
import type { ImageEdit } from './types';

// In text or shape mode only overlays of that kind can be picked, moved and resized.
export type CanvasMode = 'crop' | 'text' | 'shape' | 'view';

// A drag or pinch step on the photo: movement in photo pixels and a zoom factor.
export type CropChange = { panX: number; panY: number; zoom: number };

type PhotoCanvasProps = {
  image: SkImage;
  edit: ImageEdit;
  mode: CanvasMode;
  selectedId: string | null;
  assets: OverlayAssets;
  onCropChange: (change: CropChange) => void;
  onSelect: (id: string | null) => void;
  onOverlayChange: (id: string, change: OverlayChange) => void;
};

const FRAME_MARGIN = 16;
const BACKDROP = '#111827';

function recordPreview(
  size: Size,
  frame: Rect,
  image: SkImage,
  edit: ImageEdit,
  assets: OverlayAssets,
  selectedId: string | null
) {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, size.width, size.height));
  canvas.drawColor(Skia.Color(BACKDROP));
  drawPhoto(canvas, image, edit, frame);
  dimOutside(canvas, frame);
  canvas.save();
  canvas.clipRect(
    Skia.XYWHRect(frame.x, frame.y, frame.width, frame.height),
    ClipOp.Intersect,
    true
  );
  canvas.translate(frame.x, frame.y);
  drawOverlays(
    canvas,
    edit.overlays,
    edit.logo,
    { width: frame.width, height: frame.height },
    assets,
    selectedId
  );
  canvas.restore();
  return recorder.finishRecordingAsPicture();
}

// Gestures report small steps, and the editor applies each step to its latest state, so a pan
// and a pinch running together never undo each other.
export function PhotoCanvas({
  image,
  edit,
  mode,
  selectedId,
  assets,
  onCropChange,
  onSelect,
  onOverlayChange,
}: PhotoCanvasProps) {
  const [size, setSize] = useState<Size | null>(null);

  const cropArea = cropWindow({ width: image.width(), height: image.height() }, edit);
  const frame = size ? fitRect(size, cropArea.width / cropArea.height, FRAME_MARGIN) : null;
  const frameSize = frame ? { width: frame.width, height: frame.height } : { width: 1, height: 1 };
  const photoPixelsPerPoint = cropArea.width / frameSize.width;
  const editable =
    mode === 'text' || mode === 'shape' ? edit.overlays.filter((item) => item.kind === mode) : [];
  const outlinedId = editable.some((item) => item.id === selectedId) ? selectedId : null;
  const picture =
    size && frame ? recordPreview(size, frame, image, edit, assets, outlinedId) : null;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const overlayUnder = (x: number, y: number) =>
    overlayAt(
      editable,
      { x: x - (frame?.x ?? 0), y: y - (frame?.y ?? 0) },
      frameSize,
      assets.fonts
    );

  // Touching an overlay picks it, so it can be dragged straight away.
  const pickOverlayAt = (x: number, y: number) => {
    const hit = overlayUnder(x, y);
    if (hit && hit.id !== outlinedId) {
      onSelect(hit.id);
    }
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(4)
    .onBegin((event) => pickOverlayAt(event.x, event.y))
    .onChange((event) => {
      if (mode === 'crop') {
        // Dragging moves the photo under the frame, so the crop moves the opposite way.
        onCropChange({
          panX: -event.changeX * photoPixelsPerPoint,
          panY: -event.changeY * photoPixelsPerPoint,
          zoom: 1,
        });
      } else if (outlinedId) {
        onOverlayChange(outlinedId, {
          dx: event.changeX / frameSize.width,
          dy: event.changeY / frameSize.height,
          scale: 1,
        });
      }
    });

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onBegin((event) => pickOverlayAt(event.focalX, event.focalY))
    .onChange((event) => {
      if (mode === 'crop') {
        onCropChange({ panX: 0, panY: 0, zoom: event.scaleChange });
      } else if (outlinedId) {
        onOverlayChange(outlinedId, { dx: 0, dy: 0, scale: event.scaleChange });
      }
    });

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event, success) => {
      if (success && editable.length > 0) {
        onSelect(overlayUnder(event.x, event.y)?.id ?? null);
      }
    });

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, pinch, tap)}>
      <View
        className="flex-1"
        style={{ backgroundColor: BACKDROP }}
        onLayout={onLayout}
        collapsable={false}>
        {size && picture ? (
          <Canvas style={{ width: size.width, height: size.height }}>
            <Picture picture={picture} />
          </Canvas>
        ) : null}
      </View>
    </GestureDetector>
  );
}
