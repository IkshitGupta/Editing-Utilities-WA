import {
  MAX_VIDEO_BITRATE,
  cropForAspect,
  isFullFrame,
  outputVideoSize,
  videoBitrate,
} from '@/features/video-editor/presets';

describe('video output size', () => {
  it('keeps a 1080p video at 1080p', () => {
    expect(outputVideoSize(16 / 9, 1080)).toEqual({ width: 1920, height: 1080 });
  });

  it('keeps portrait videos portrait', () => {
    expect(outputVideoSize(9 / 16, 1080)).toEqual({ width: 1080, height: 1920 });
  });

  it('never enlarges a small video', () => {
    expect(outputVideoSize(16 / 9, 480)).toEqual({ width: 854, height: 480 });
  });

  it('keeps 4K videos at 4K', () => {
    expect(outputVideoSize(16 / 9, 2160)).toEqual({ width: 3840, height: 2160 });
  });

  it('limits larger videos to 4K', () => {
    expect(outputVideoSize(16 / 9, 4320)).toEqual({ width: 3840, height: 2160 });
    expect(outputVideoSize(1, 3000)).toEqual({ width: 2160, height: 2160 });
  });

  it('always returns even sizes for the encoder', () => {
    const size = outputVideoSize(4 / 3, 721);
    expect(size.width % 2).toBe(0);
    expect(size.height % 2).toBe(0);
  });
});

describe('video bitrate', () => {
  const full = { width: 1920, height: 1080 };

  it('matches the bitrate of a phone recording', () => {
    expect(videoBitrate(full, [{ width: 1920, height: 1080, bitrate: 17_000_000 }])).toBe(
      17_000_000
    );
  });

  it('lowers the bitrate in step with a smaller crop', () => {
    const square = { width: 1080, height: 1080 };
    expect(videoBitrate(square, [{ width: 1920, height: 1080, bitrate: 16_000_000 }])).toBe(
      9_000_000
    );
  });

  it('gives already-compressed videos room so they lose no more detail', () => {
    const small = { width: 854, height: 480 };
    expect(videoBitrate(small, [{ width: 854, height: 480, bitrate: 500_000 }])).toBe(1_639_680);
  });

  it('uses a phone-camera rate when the file does not say', () => {
    expect(videoBitrate(full, [{ width: 1920, height: 1080, bitrate: 0 }])).toBe(16_588_800);
  });

  it('follows the most detailed of the joined clips', () => {
    const clips = [
      { width: 1280, height: 720, bitrate: 3_000_000 },
      { width: 1920, height: 1080, bitrate: 20_000_000 },
    ];
    expect(videoBitrate(full, clips)).toBe(20_000_000);
  });

  it('stays within what phone encoders accept', () => {
    const huge = { width: 3840, height: 2160 };
    expect(videoBitrate(huge, [{ width: 3840, height: 2160, bitrate: 400_000_000 }])).toBe(
      MAX_VIDEO_BITRATE
    );
  });
});

describe('video crop', () => {
  it('keeps the whole frame when no shape is chosen', () => {
    expect(isFullFrame(cropForAspect({ width: 1920, height: 1080 }, null, 0))).toBe(true);
  });

  it('crops the sides of a wide video for a square', () => {
    const crop = cropForAspect({ width: 1920, height: 1080 }, 1, 0);
    expect(crop.top).toBe(0);
    expect(crop.bottom).toBe(1);
    expect(crop.right - crop.left).toBeCloseTo(0.5625);
    expect(crop.left).toBeCloseTo((1 - 0.5625) / 2);
  });

  it('slides the crop to either side', () => {
    expect(cropForAspect({ width: 1920, height: 1080 }, 1, -1).left).toBe(0);
    expect(cropForAspect({ width: 1920, height: 1080 }, 1, 1).right).toBeCloseTo(1);
  });

  it('crops the top and bottom of a tall video for wide output', () => {
    const crop = cropForAspect({ width: 1080, height: 1920 }, 16 / 9, 0);
    expect(crop.left).toBe(0);
    expect(crop.right).toBe(1);
    expect(crop.bottom - crop.top).toBeCloseTo(0.31640625);
  });
});
