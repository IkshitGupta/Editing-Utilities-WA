import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { VideoView, type VideoPlayer } from 'expo-video';
import { useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { fitRect, orientedSize } from '@/features/image-editor/geometry';
import { drawOverlays, type OverlayAssets } from '@/features/overlays/draw';

import { clipCrop, outputAspect, type VideoClip, type VideoEdit } from './edit-list';

type VideoPreviewProps = {
  player: VideoPlayer;
  clip: VideoClip;
  edit: VideoEdit;
  assets: OverlayAssets;
  playing: boolean;
  onTogglePlay: () => void;
};

export function VideoPreview({
  player,
  clip,
  edit,
  assets,
  playing,
  onTogglePlay,
}: VideoPreviewProps) {
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea({ width, height });
  };

  const frame = area ? fitRect(area, outputAspect(edit), 12) : null;

  let content = null;
  if (frame) {
    // Lay the rotated video out at a scale where the cropped part exactly fills the frame.
    const rotated = orientedSize(clip, edit.rotation);
    const crop = clipCrop(clip, edit);
    const scale = frame.width / Math.max(1, (crop.right - crop.left) * rotated.width);
    const contentWidth = rotated.width * scale;
    const contentHeight = rotated.height * scale;
    const quarterTurn = edit.rotation === 90 || edit.rotation === 270;
    const viewWidth = quarterTurn ? contentHeight : contentWidth;
    const viewHeight = quarterTurn ? contentWidth : contentHeight;

    const captions = edit.caption && edit.caption.text.trim() ? [edit.caption] : [];
    const recorder = Skia.PictureRecorder();
    drawOverlays(
      recorder.beginRecording(Skia.XYWHRect(0, 0, frame.width, frame.height)),
      captions,
      edit.logo,
      { width: frame.width, height: frame.height },
      assets
    );
    const overlay = recorder.finishRecordingAsPicture();

    content = (
      <View
        className="absolute overflow-hidden bg-black"
        style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}>
        <View
          className="absolute"
          style={{
            left: -crop.left * contentWidth,
            top: -crop.top * contentHeight,
            width: contentWidth,
            height: contentHeight,
          }}>
          <VideoView
            player={player}
            nativeControls={false}
            contentFit="fill"
            surfaceType="textureView"
            style={{
              position: 'absolute',
              left: (contentWidth - viewWidth) / 2,
              top: (contentHeight - viewHeight) / 2,
              width: viewWidth,
              height: viewHeight,
              transform: [{ rotate: `${edit.rotation}deg` }],
            }}
          />
        </View>
        <Canvas
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: frame.width,
            height: frame.height,
            pointerEvents: 'none',
          }}>
          <Picture picture={overlay} />
        </Canvas>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          onPress={onTogglePlay}
          className="absolute inset-0 items-center justify-center">
          {playing ? null : (
            <View className="h-16 w-16 items-center justify-center rounded-full bg-black/50">
              <Icon name="play" size={34} color="#FFFFFF" />
            </View>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#111827]" onLayout={onLayout}>
      {content}
    </View>
  );
}
