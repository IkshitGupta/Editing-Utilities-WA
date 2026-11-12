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

export type PrepareOptions = {
  maxSide?: number;
  // Writes a PNG copy, so see-through parts of the picture stay see-through. A JPEG copy turns
  // them black.
  keepTransparency?: boolean;
};

// Decodes the photo at a bounded size (so very large camera photos do not run out of memory),
// applies its stored orientation, and writes a plain JPEG (or PNG) copy without location metadata.
// The copy uses the highest JPEG quality, so this step adds no visible loss before editing.
export async function prepareImage(
  uri: string,
  { maxSide = MAX_SOURCE_SIDE, keepTransparency = false }: PrepareOptions = {}
): Promise<SourceImage> {
  const decoded = await Image.loadAsync(uri, {
    maxWidth: maxSide,
    maxHeight: maxSide,
  });
  // GIFs and moving pictures load as animations, which the next step can't read.
  if (decoded.isAnimated) {
    throw new Error('GIFs and moving pictures cannot be used. Choose a photo instead.');
  }
  const rendered = await ImageManipulator.manipulate(decoded).renderAsync();
  const saved = await rendered.saveAsync(
    keepTransparency ? { format: SaveFormat.PNG } : { format: SaveFormat.JPEG, compress: 1 }
  );
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
