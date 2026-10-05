import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type SourceImage = {
  uri: string;
  width: number;
  height: number;
};

// Phone photos up to 12.5 MP (4080 × 3072) keep every pixel. Larger ones are reduced to 4096
// pixels, the most WhatsApp's HD option sends, so they still open smoothly on a mid-range phone.
export const MAX_SOURCE_SIDE = 4096;

// Decodes the photo at a bounded size (so very large camera photos do not run out of memory),
// applies its stored orientation, and writes a plain JPEG copy without location metadata.
// The copy uses the highest JPEG quality, so this step adds no visible loss before editing.
export async function prepareImage(uri: string): Promise<SourceImage> {
  const decoded = await Image.loadAsync(uri, {
    maxWidth: MAX_SOURCE_SIDE,
    maxHeight: MAX_SOURCE_SIDE,
  });
  const rendered = await ImageManipulator.manipulate(decoded).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
