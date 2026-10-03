import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type SourceImage = {
  uri: string;
  width: number;
  height: number;
};

// Large enough for any preset, small enough to edit smoothly on a mid-range phone.
export const MAX_SOURCE_SIDE = 3000;

// Decodes the photo at a bounded size (so very large camera photos do not run out of memory),
// applies its stored orientation, and writes a plain JPEG copy without location metadata.
export async function prepareImage(uri: string): Promise<SourceImage> {
  const decoded = await Image.loadAsync(uri, {
    maxWidth: MAX_SOURCE_SIDE,
    maxHeight: MAX_SOURCE_SIDE,
  });
  const rendered = await ImageManipulator.manipulate(decoded).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
