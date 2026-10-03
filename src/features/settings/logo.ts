import { Image } from 'expo-image';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { pickMedia } from '@/features/media/picker';
import { persistentFile } from '@/lib/files';

const LOGO_MAX_SIDE = 800;

// Keeps a private copy of the chosen logo, so it still works if the original is deleted from the gallery.
export async function chooseCustomLogo(): Promise<string | null> {
  const [picked] = await pickMedia({ kinds: ['image'], multiple: false });
  if (!picked) {
    return null;
  }
  const decoded = await Image.loadAsync(picked.uri, {
    maxWidth: LOGO_MAX_SIDE,
    maxHeight: LOGO_MAX_SIDE,
  });
  const rendered = await ImageManipulator.manipulate(decoded).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.PNG });
  const target = persistentFile('branding', `logo-${Date.now()}.png`);
  await new File(saved.uri).copy(target);
  return target.uri;
}
