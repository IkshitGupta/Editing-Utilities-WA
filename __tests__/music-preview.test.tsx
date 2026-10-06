import { act, renderHook } from '@testing-library/react-native';
import { setIsAudioActiveAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import type { VideoPlayer } from 'expo-video';

import { DEFAULT_LOGO } from '@/features/overlays/types';
import type { VideoClip, VideoEdit } from '@/features/video-editor/edit-list';
import { useMusicPreview } from '@/features/video-editor/music-preview';
import { TUNES, musicFileUri, tuneFileUri } from '@/features/video-editor/tunes';

jest.mock('expo-audio', () => ({
  useAudioPlayer: jest.fn(),
  setIsAudioActiveAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/features/video-editor/tunes', () => ({
  ...jest.requireActual('@/features/video-editor/tunes'),
  musicFileUri: jest.fn(),
  tuneFileUri: jest.fn(),
}));

const TUNE_URI = 'file:///cache/ExponentAsset-tune.m4a';

class FakeEmitter {
  private listeners = new Map<string, Set<(event: unknown) => void>>();

  addListener(name: string, listener: (event: unknown) => void) {
    const listeners = this.listeners.get(name) ?? new Set();
    this.listeners.set(name, listeners);
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  }

  emit(name: string, event: unknown) {
    this.listeners.get(name)?.forEach((listener) => listener(event));
  }
}

// Like expo-video, a pause takes effect later on the main thread, so it reports nothing here.
class FakeVideo extends FakeEmitter {
  playing = false;
  currentTime = 0;
  volume = 1;
  muted = false;
  audioMixingMode = 'auto';
  play = jest.fn();
  pause = jest.fn();

  start() {
    this.playing = true;
    this.emit('playingChange', { isPlaying: true });
  }

  tick() {
    this.emit('timeUpdate', { currentTime: this.currentTime });
  }
}

// The fields describe the player's live state; reports are sent separately and may be stale.
class FakeAudio extends FakeEmitter {
  state = 'ready';
  loop = false;
  volume = 1;
  duration = 0;
  currentTime = 0;
  playing = false;
  replace = jest.fn();
  play = jest.fn(() => {
    this.playing = true;
  });
  pause = jest.fn(() => {
    this.playing = false;
  });
  seekTo = jest.fn((seconds: number) => {
    this.currentTime = seconds;
    return Promise.resolve();
  });

  get currentStatus() {
    return { playbackState: this.state, playing: this.playing, currentTime: this.currentTime };
  }

  report(status: Record<string, unknown>) {
    this.emit('playbackStatusUpdate', {
      playing: this.playing,
      playbackState: this.state,
      didJustFinish: false,
      ...status,
    });
  }
}

const clip = (id: string): VideoClip => ({
  id,
  uri: `content://media/external/video/media/${id}`,
  width: 1920,
  height: 1080,
  durationMs: 10_000,
  hasAudio: true,
  bitrate: 16_000_000,
  codec: 'video/avc',
  startMs: 0,
  endMs: 10_000,
});

const clips = [clip('a'), clip('b')];

const edit = (patch: Partial<VideoEdit> = {}): VideoEdit => ({
  clips,
  rotation: 0,
  shape: 'original',
  position: 0,
  sound: 'music',
  music: { kind: 'tune', tuneId: TUNES[0].id },
  musicVolume: 0.6,
  mixOriginal: false,
  logo: DEFAULT_LOGO,
  caption: null,
  ...patch,
});

type Props = { video: FakeVideo; edit: VideoEdit; clip: VideoClip };

let audio: FakeAudio;
let now: number;

beforeEach(() => {
  jest.clearAllMocks();
  audio = new FakeAudio();
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.mocked(useAudioPlayer).mockReturnValue(audio as unknown as AudioPlayer);
  jest.mocked(musicFileUri).mockResolvedValue(TUNE_URI);
  jest.mocked(tuneFileUri).mockResolvedValue(TUNE_URI);
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function preview(props: Props) {
  const hook = await renderHook(
    ({ video, edit: current, clip: active }: Props) =>
      useMusicPreview(video as unknown as VideoPlayer, current, active),
    { initialProps: props }
  );
  // Lets the chosen tune resolve to its file.
  await act(async () => undefined);
  return hook;
}

async function playing(video = new FakeVideo()) {
  const hook = await preview({ video, edit: edit(), clip: clips[0] });
  await act(async () => video.start());
  return { hook, video };
}

describe('music preview', () => {
  it('plays the chosen music with the video', async () => {
    const { video } = await playing();
    expect(audio.replace).toHaveBeenCalledWith({ uri: TUNE_URI });
    expect(audio.play).toHaveBeenCalled();
    expect(audio.loop).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.audioMixingMode).toBe('mixWithOthers');
  });

  it('stops the music when another clip opens while the video plays', async () => {
    const current = edit();
    const first = new FakeVideo();
    const hook = await preview({ video: first, edit: current, clip: clips[0] });
    await act(async () => first.start());
    expect(audio.playing).toBe(true);

    // The editor pauses the old player and opens the clip in a new, paused one.
    const second = new FakeVideo();
    await hook.rerender({ video: second, edit: current, clip: clips[1] });
    expect(audio.playing).toBe(false);

    now += 5_000;
    audio.seekTo.mockClear();
    await act(async () => second.tick());
    expect(audio.seekTo).not.toHaveBeenCalled();
    expect(audio.playing).toBe(false);
  });

  it('waits at the start of a tune that Listen played to its end', async () => {
    const video = new FakeVideo();
    const hook = await preview({ video, edit: edit(), clip: clips[0] });
    await act(async () => hook.result.current.listen(TUNES[0]));
    await act(async () => undefined);
    expect(hook.result.current.listeningTo).toBe(TUNES[0].id);
    expect(audio.play).toHaveBeenCalled();

    audio.playing = false;
    audio.state = 'ended';
    audio.currentTime = TUNES[0].durationMs / 1000;
    audio.seekTo.mockClear();
    await act(async () => audio.report({ didJustFinish: true }));
    expect(hook.result.current.listeningTo).toBeNull();
    expect(audio.seekTo).toHaveBeenCalledWith(0);
    audio.state = 'ready';

    audio.play.mockClear();
    await act(async () => video.start());
    expect(audio.play).toHaveBeenCalled();
    expect(audio.currentTime).toBe(0);
  });

  it('drops a Listen request that finishes loading after the editor closes', async () => {
    let finish: (uri: string) => void = () => undefined;
    jest.mocked(tuneFileUri).mockReturnValue(
      new Promise<string>((resolve) => {
        finish = resolve;
      })
    );
    const hook = await preview({ video: new FakeVideo(), edit: edit(), clip: clips[0] });
    await act(async () => hook.result.current.listen(TUNES[1]));
    await hook.unmount();
    expect(audio.pause).toHaveBeenCalled();

    await act(async () => finish('file:///cache/ExponentAsset-other.m4a'));
    expect(audio.replace).not.toHaveBeenCalled();
  });

  it('gives the sound back when the editor closes while the music loads', async () => {
    const { hook } = await playing();
    audio.state = 'buffering';
    audio.playing = false;
    await hook.unmount();
    await act(async () => undefined);
    expect(jest.mocked(setIsAudioActiveAsync).mock.calls).toEqual([[false], [true]]);
  });

  it('switches audio on again even if switching it off fails', async () => {
    jest.mocked(setIsAudioActiveAsync).mockRejectedValueOnce(new Error('Audio unavailable'));
    const { hook } = await playing();
    await hook.unmount();
    await act(async () => undefined);
    expect(jest.mocked(setIsAudioActiveAsync).mock.calls).toEqual([[false], [true]]);
  });

  it('follows the Keep original sound switch while the music loads', async () => {
    jest.mocked(musicFileUri).mockReturnValue(new Promise<string>(() => undefined));
    const video = new FakeVideo();
    await preview({ video, edit: edit({ mixOriginal: false }), clip: clips[0] });
    await act(async () => video.start());
    expect(audio.play).not.toHaveBeenCalled();
    expect(video.muted).toBe(true);
    expect(video.audioMixingMode).toBe('mixWithOthers');
  });

  it('takes the audio focus again once the music plays after loading', async () => {
    const { video } = await playing();
    audio.play.mockClear();

    await act(async () => audio.report({ playbackState: 'buffering' }));
    await act(async () => video.tick());
    expect(audio.play).toHaveBeenCalledTimes(1);
    await act(async () => video.tick());
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it('pauses the preview when another app takes the sound, even right after it starts', async () => {
    const { video } = await playing();
    await act(async () => audio.report({ playbackState: 'buffering' }));

    // Another app's sound pauses the music; a report from before still says it plays.
    audio.playing = false;
    audio.play.mockClear();
    await act(async () => audio.report({ playing: true }));
    await act(async () => video.tick());
    expect(video.pause).toHaveBeenCalled();
    expect(audio.play).not.toHaveBeenCalled();
  });

  it('ignores out-of-date pause reports and music that is still loading', async () => {
    const { video } = await playing();
    await act(async () => audio.report({ playing: false }));
    await act(async () => video.tick());
    expect(video.pause).not.toHaveBeenCalled();

    audio.state = 'buffering';
    audio.playing = false;
    now += 5_000;
    await act(async () => video.tick());
    expect(video.pause).not.toHaveBeenCalled();
  });

  it('allows for the time the music takes to start again after a jump', async () => {
    const { video } = await playing();
    // After each jump the music stays silent for 600 ms while the video carries on.
    const silentMs = 600;
    let target = 0;
    let jumpedAt = now;
    audio.seekTo.mockImplementation((seconds: number) => {
      target = seconds * 1000;
      jumpedAt = now;
      audio.currentTime = seconds;
      return Promise.resolve();
    });

    const jumps: number[] = [];
    for (let step = 1; step <= 45; step++) {
      now += 200;
      video.currentTime = step * 0.2;
      audio.currentTime = (target + Math.max(0, now - jumpedAt - silentMs)) / 1000;
      const before = audio.seekTo.mock.calls.length;
      await act(async () => video.tick());
      if (audio.seekTo.mock.calls.length > before) {
        jumps.push(step * 200);
      }
    }
    expect(jumps).toEqual([1000, 2000]);
    expect(audio.seekTo).toHaveBeenLastCalledWith(2.6);
  });
});
