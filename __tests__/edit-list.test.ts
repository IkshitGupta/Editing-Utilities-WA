import {
  MIN_CLIP_MS,
  buildRenderSpec,
  outputAspect,
  renderSpecSchema,
  trimClip,
  trimmedDurationMs,
  type VideoClip,
  type VideoEdit,
} from '@/features/video-editor/edit-list';
import { DEFAULT_LOGO } from '@/features/overlays/types';

const clip = (patch: Partial<VideoClip> = {}): VideoClip => ({
  id: 'a',
  uri: 'content://media/external/video/media/1',
  width: 1920,
  height: 1080,
  durationMs: 60_000,
  hasAudio: true,
  startMs: 0,
  endMs: 60_000,
  ...patch,
});

const edit = (patch: Partial<VideoEdit> = {}): VideoEdit => ({
  clips: [clip()],
  rotation: 0,
  shape: 'original',
  position: 0,
  sound: 'original',
  music: null,
  musicVolume: 0.6,
  mixOriginal: false,
  preset: 'whatsapp',
  logo: DEFAULT_LOGO,
  caption: null,
  ...patch,
});

describe('render spec', () => {
  it('builds a valid spec for a single clip', () => {
    const spec = renderSpecSchema.parse(buildRenderSpec(edit(), null));
    expect(spec).toMatchObject({
      rotationDegrees: 0,
      width: 1280,
      height: 720,
      keepOriginalAudio: true,
      originalVolume: 1,
      musicUri: null,
      overlayUri: null,
    });
    expect(spec.clips).toEqual([
      { uri: 'content://media/external/video/media/1', startMs: 0, endMs: 60_000, crop: null },
    ]);
  });

  it('crops every joined clip to the first clip’s shape', () => {
    const portrait = clip({ id: 'b', width: 1080, height: 1920 });
    const spec = buildRenderSpec(edit({ clips: [clip(), portrait] }), null);
    expect(spec.clips[0].crop).toBeNull();
    expect(spec.clips[1].crop).not.toBeNull();
    expect(outputAspect(edit({ clips: [clip(), portrait] }))).toBeCloseTo(16 / 9);
  });

  it('turns the output when the video is rotated', () => {
    const spec = buildRenderSpec(edit({ rotation: 90 }), null);
    expect(spec).toMatchObject({ rotationDegrees: 90, width: 720, height: 1280 });
  });

  it('mutes the video', () => {
    expect(buildRenderSpec(edit({ sound: 'mute' }), null)).toMatchObject({
      keepOriginalAudio: false,
      musicUri: null,
    });
  });

  it('replaces the sound with music, or mixes it quietly', () => {
    const music = { uri: 'file:///cache/song.mp3', name: 'song.mp3' };
    expect(buildRenderSpec(edit({ sound: 'music', music }), null)).toMatchObject({
      keepOriginalAudio: false,
      musicUri: music.uri,
      originalVolume: 0.35,
    });
    expect(buildRenderSpec(edit({ sound: 'music', music, mixOriginal: true }), null)).toMatchObject(
      {
        keepOriginalAudio: true,
        musicUri: music.uri,
      }
    );
  });

  it('keeps the original sound when music was chosen but no song was picked', () => {
    expect(buildRenderSpec(edit({ sound: 'music' }), null)).toMatchObject({
      keepOriginalAudio: true,
      musicUri: null,
    });
  });

  it('makes Shorts tall without enlarging the cropped picture', () => {
    expect(buildRenderSpec(edit({ shape: 'tall', preset: 'shorts' }), null)).toMatchObject({
      width: 608,
      height: 1080,
    });
  });

  it('adds up the trimmed length of all clips', () => {
    expect(
      trimmedDurationMs([
        clip({ startMs: 5_000, endMs: 15_000 }),
        clip({ startMs: 0, endMs: 2_000 }),
      ])
    ).toBe(12_000);
  });

  it('rejects clips shorter than half a second', () => {
    const spec = buildRenderSpec(edit({ clips: [clip({ startMs: 1_000, endMs: 1_200 })] }), null);
    expect(renderSpecSchema.safeParse(spec).success).toBe(false);
  });

  it('rejects odd sizes and empty clip lists', () => {
    const spec = buildRenderSpec(edit(), null);
    expect(renderSpecSchema.safeParse({ ...spec, width: 1281 }).success).toBe(false);
    expect(renderSpecSchema.safeParse({ ...spec, clips: [] }).success).toBe(false);
  });
});

describe('trimming', () => {
  it('adds up small drag steps', () => {
    let trimmed = clip();
    for (let step = 0; step < 10; step += 1) {
      trimmed = trimClip(trimmed, 'start', 0.4);
    }
    expect(trimmed.startMs).toBeCloseTo(4);
    expect(buildRenderSpec(edit({ clips: [trimmed] }), null).clips[0].startMs).toBe(4);
  });

  it('keeps both handles inside the video', () => {
    expect(trimClip(clip(), 'start', -5_000).startMs).toBe(0);
    expect(trimClip(clip(), 'end', 5_000).endMs).toBe(60_000);
  });

  it('keeps at least a second between the handles', () => {
    const short = clip({ startMs: 10_000, endMs: 20_000 });
    expect(trimClip(short, 'start', 50_000).startMs).toBe(20_000 - MIN_CLIP_MS);
    expect(trimClip(short, 'end', -50_000).endMs).toBe(10_000 + MIN_CLIP_MS);
  });
});
