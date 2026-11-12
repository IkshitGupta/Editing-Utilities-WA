import { Image } from 'expo-image';
import { ImageManipulator } from 'expo-image-manipulator';

import { prepareImage } from '@/features/media/prepare-image';

jest.mock('expo-image', () => ({ Image: { loadAsync: jest.fn() } }));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

describe('prepareImage', () => {
  it('turns away GIFs and moving pictures with a plain message', async () => {
    jest.mocked(Image.loadAsync).mockResolvedValue({ isAnimated: true } as never);
    await expect(prepareImage('file:///sticker.webp')).rejects.toThrow(
      'GIFs and moving pictures cannot be used. Choose a photo instead.'
    );
    expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
  });
});
