import {
  MIN_VIDEO_BITRATE,
  VIDEO_PRESETS,
  cropForAspect,
  estimatedBytes,
  isFullFrame,
  longestFittingSeconds,
  outputVideoSize,
  videoBitrate,
} from '@/features/video-editor/presets';

describe('video output size', () => {
  it('makes 720p for WhatsApp from a 1080p landscape video', () => {
    expect(outputVideoSize(16 / 9, VIDEO_PRESETS.whatsapp, 1080)).toEqual({
      width: 1280,
      height: 720,
    });
  });

  it('keeps portrait videos portrait', () => {
    expect(outputVideoSize(9 / 16, VIDEO_PRESETS.youtube, 1080)).toEqual({
      width: 1080,
      height: 1920,
    });
  });

  it('never enlarges a small video', () => {
    expect(outputVideoSize(16 / 9, VIDEO_PRESETS.youtube, 480)).toEqual({
      width: 854,
      height: 480,
    });
  });

  it('always returns even sizes for the encoder', () => {
    const size = outputVideoSize(4 / 3, VIDEO_PRESETS.whatsapp, 721);
    expect(size.width % 2).toBe(0);
    expect(size.height % 2).toBe(0);
  });

  it('limits very wide videos to 1920 pixels', () => {
    expect(outputVideoSize(3, VIDEO_PRESETS.youtube, 1080)).toEqual({ width: 1920, height: 640 });
  });
});

describe('video bitrate', () => {
  it('uses the full WhatsApp quality for short clips', () => {
    expect(videoBitrate(VIDEO_PRESETS.whatsapp, 30_000)).toEqual({
      bitrate: 2_500_000,
      tooLong: false,
    });
  });

  it('lowers the quality of longer clips to stay near 16 MB', () => {
    const { bitrate, tooLong } = videoBitrate(VIDEO_PRESETS.whatsapp, 120_000);
    expect(tooLong).toBe(false);
    expect(bitrate).toBeLessThan(2_500_000);
    expect(estimatedBytes(bitrate, 120_000)).toBeLessThanOrEqual(16 * 1024 * 1024);
  });

  it('flags clips too long to fit', () => {
    expect(videoBitrate(VIDEO_PRESETS.whatsapp, 10 * 60_000)).toEqual({
      bitrate: MIN_VIDEO_BITRATE,
      tooLong: true,
    });
    expect(longestFittingSeconds(VIDEO_PRESETS.whatsapp)).toBeGreaterThan(150);
  });

  it('keeps the preset quality when there is no size target', () => {
    expect(videoBitrate(VIDEO_PRESETS.youtube, 10 * 60_000)).toEqual({
      bitrate: 8_000_000,
      tooLong: false,
    });
    expect(longestFittingSeconds(VIDEO_PRESETS.youtube)).toBeNull();
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
