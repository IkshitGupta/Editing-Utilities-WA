import { Image } from 'expo-image';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { pickMedia } from '@/features/media/picker';
import { deleteTemporaryFile, persistentFile } from '@/lib/files';

// Large enough to stay sharp on full-size photos and 4K video.
const LOGO_MAX_SIDE = 2048;

// Keeps a private copy of the chosen logo, so it still works if the original is deleted from the gallery.
export async function chooseCustomLogo(): Promise<string | null> {
  const [picked] = await pickMedia({ kinds: ['image'], multiple: false });
  if (!picked) {
    return null;
  }
  try {
    const decoded = await Image.loadAsync(picked.uri, {
      maxWidth: LOGO_MAX_SIDE,
      maxHeight: LOGO_MAX_SIDE,
    });
    const rendered = await ImageManipulator.manipulate(decoded).renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.PNG });
    const target = persistentFile('branding', `logo-${Date.now()}.png`);
    try {
      await new File(saved.uri).copy(target);
    } finally {
      deleteTemporaryFile(saved.uri);
    }
    return target.uri;
  } finally {
    deleteTemporaryFile(picked.uri);
  }
}
