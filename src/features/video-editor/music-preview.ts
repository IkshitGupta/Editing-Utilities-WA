import { useEventListener } from 'expo';
import {
  setIsAudioActiveAsync,
  useAudioPlayer,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import type { VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { clamp } from '@/lib/utils';

import { trimmedDurationMs, type MusicChoice, type VideoClip, type VideoEdit } from './edit-list';
import { loopDriftMs, loopPositionMs, savedVideoPositionMs, soundLevels } from './music-mix';
import { currentTimeMs, setMixesWithMusic, setSoundLevel } from './player-control';
import { findTune, musicFileUri, tuneFileUri, type Tune } from './tunes';

// Gaps up to this size go unnoticed; correcting them would only add small jumps.
const MAX_DRIFT_MS = 250;
// After the music starts or jumps, it gets this long to play before its position is checked.
const SETTLE_MS = 1000;
// The longest time allowed for the music to start again after a jump. Longer gaps come from the
// video moving.
const MAX_RESTART_MS = 2000;

// Player changes live outside the hook so React Compiler can keep optimising the editor.

function loadAudio(audio: AudioPlayer, uri: string, loadedUri: { current: string | null }) {
  if (loadedUri.current !== uri) {
    audio.replace({ uri });
    loadedUri.current = uri;
  }
}

// Starts the music, first moving it to `positionMs` when one is given.
function startAudio(audio: AudioPlayer, positionMs: number | null, loop: boolean, volume: number) {
  audio.loop = loop;
  audio.volume = volume;
  if (positionMs !== null) {
    audio.seekTo(positionMs / 1000).catch(() => undefined);
  }
  audio.play();
}

function setAudioVolume(audio: AudioPlayer, volume: number) {
  audio.volume = volume;
}

function seekAudio(audio: AudioPlayer, positionMs: number) {
  audio.seekTo(positionMs / 1000).catch(() => undefined);
}

// A tune that has played to its end stays there, where playing it again does nothing, so it
// waits at the start instead.
function rewindAudio(audio: AudioPlayer) {
  audio.pause();
  seekAudio(audio, 0);
}

function audioDurationMs(audio: AudioPlayer): number {
  return audio.duration * 1000;
}

function audioPositionMs(audio: AudioPlayer): number {
  return audio.currentTime * 1000;
}

// The player's state now. Reports from the player arrive later and may be out of date.
function audioStatus(audio: AudioPlayer): AudioStatus {
  return audio.currentStatus;
}

// expo-audio gives up the audio focus only when playback stops, so music that never started
// keeps it. Switching audio off and on again gives it back. Audio is switched on again even if
// switching it off fails, so music still plays in the next editor.
function releaseAudioFocus() {
  setIsAudioActiveAsync(false)
    .catch(() => undefined)
    .then(() => setIsAudioActiveAsync(true))
    .catch(() => undefined);
}

type MusicPreview = {
  // The tune playing through its Listen button, if any.
  listeningTo: string | null;
  listen: (tune: Tune) => void;
  stopListening: () => void;
};

// Plays the chosen music with the video, from the point the saved video would be at, and plays
// tunes on their own for Listen.
export function useMusicPreview(
  video: VideoPlayer,
  edit: VideoEdit | null,
  clip: VideoClip | null
): MusicPreview {
  // The audio mode keeps expo-audio's defaults, so phone calls keep their own speaker or earpiece
  // setting.
  const audio = useAudioPlayer(null, { updateInterval: 250 });
  const [listeningTo, setListeningTo] = useState<string | null>(null);
  const [resolved, setResolved] = useState<{ music: MusicChoice; uri: string } | null>(null);
  // Read and changed from player events, so they live outside React state.
  const loadedUri = useRef<string | null>(null);
  const listenTarget = useRef<string | null>(null);
  const following = useRef(false);
  const movedAt = useRef(0);
  // While the video plays, the music needs a moment to start again after a jump, so it falls
  // behind. The gap measured after each jump sends the next one that much further.
  const restartMs = useRef(0);
  const corrected = useRef(false);
  const reloading = useRef(false);
  const played = useRef(false);
  const closed = useRef(false);

  const music = edit?.sound === 'music' ? edit.music : null;
  const musicUri = music && resolved?.music === music ? resolved.uri : null;
  const tuneMs = music?.kind === 'tune' ? (findTune(music.tuneId)?.durationMs ?? 0) : 0;

  useEffect(() => {
    if (!music) {
      return;
    }
    let cancelled = false;
    // A tune that can't be opened is left out of the preview; saving reports the problem.
    musicFileUri(music).then(
      (uri) => {
        if (!cancelled) {
          setResolved({ music, uri });
        }
      },
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, [music]);

  const follow = useCallback(
    (checkDrift: boolean) => {
      if (closed.current || !edit || !clip) {
        return;
      }
      // The player is asked directly, because a clip opens in a new player that starts paused
      // without reporting it.
      const playing = video.playing && !listenTarget.current;
      const chosen = edit.sound === 'music' && edit.music !== null;
      const videoMs = trimmedDurationMs(edit.clips);
      // Reading the position waits for the video player, so it happens only when the music needs it.
      const positionMs =
        playing && chosen ? savedVideoPositionMs(edit.clips, clip.id, currentTimeMs(video)) : 0;
      // The chosen music sets the mix even while it loads, so the clip's own sound follows the
      // "Keep original sound" switch.
      const levels = soundLevels(edit, chosen, positionMs, videoMs);
      setMixesWithMusic(video, chosen);
      setSoundLevel(video, levels.original);
      if (!musicUri || !playing) {
        if (following.current) {
          following.current = false;
          audio.pause();
        }
        return;
      }
      // Until the chosen music is loaded, the player's length is that of the last tune played.
      const loaded = loadedUri.current === musicUri;
      const musicMs = (loaded ? audioDurationMs(audio) : 0) || tuneMs;
      const expectedMs = loopPositionMs(positionMs, musicMs);
      if (!following.current || !loaded) {
        following.current = true;
        // After a short stall the music is still in step, so it carries on from where it paused.
        const inStep =
          loaded &&
          Math.abs(loopDriftMs(audioPositionMs(audio), expectedMs, musicMs)) <= MAX_DRIFT_MS;
        loadAudio(audio, musicUri, loadedUri);
        startAudio(audio, inStep ? null : expectedMs, true, levels.music);
        played.current = true;
        corrected.current = false;
        movedAt.current = Date.now();
        return;
      }
      setAudioVolume(audio, levels.music);
      if (!checkDrift) {
        return;
      }
      const status = audioStatus(audio);
      if (status.playbackState !== 'ready') {
        return;
      }
      if (!status.playing) {
        // Another app has taken the sound, so the preview pauses, as other players do.
        video.pause();
        return;
      }
      if (reloading.current) {
        // Pausing to load gave up the audio focus, so the music takes it again.
        reloading.current = false;
        audio.play();
      }
      if (musicMs > 0 && Date.now() - movedAt.current >= SETTLE_MS) {
        const driftMs = loopDriftMs(status.currentTime * 1000, expectedMs, musicMs);
        if (corrected.current) {
          corrected.current = false;
          // The gap left by the last jump is the time the music took to start again.
          if (Math.abs(driftMs) <= MAX_RESTART_MS) {
            restartMs.current = clamp(restartMs.current - driftMs, 0, MAX_RESTART_MS);
          }
        }
        if (Math.abs(driftMs) > MAX_DRIFT_MS) {
          seekAudio(audio, loopPositionMs(expectedMs + restartMs.current, musicMs));
          corrected.current = true;
          movedAt.current = Date.now();
        }
      }
    },
    [audio, video, edit, clip, musicUri, tuneMs]
  );

  // Settings changed while the video plays take effect straight away.
  useEffect(() => {
    follow(false);
  }, [follow]);

  // Stops the music before the player is released, so other apps get their sound back. Events
  // that arrive while the editor closes are ignored, so nothing starts the music again.
  useLayoutEffect(() => {
    closed.current = false;
    return () => {
      closed.current = true;
      listenTarget.current = null;
      following.current = false;
      audio.pause();
      if (played.current) {
        releaseAudioFocus();
      }
    };
  }, [audio]);

  useEventListener(video, 'playingChange', ({ isPlaying }) => {
    if (isPlaying && listenTarget.current) {
      listenTarget.current = null;
      setListeningTo(null);
    }
    follow(false);
  });

  useEventListener(video, 'timeUpdate', () => {
    if (following.current || video.playing) {
      follow(true);
    }
  });

  useEventListener(audio, 'playbackStatusUpdate', (status) => {
    if (status.didJustFinish) {
      if (listenTarget.current) {
        listenTarget.current = null;
        setListeningTo(null);
      }
      if (!following.current) {
        rewindAudio(audio);
      }
      return;
    }
    if (!following.current) {
      // expo-audio resumes paused sound when the app comes back, so anything not asked for stops
      // again.
      if (status.playing && !listenTarget.current) {
        audio.pause();
      }
      return;
    }
    if (status.playbackState !== 'ready') {
      // Loading gives up the audio focus, so the music takes it again once it plays.
      reloading.current = true;
    }
  });

  const stopListening = () => {
    if (listenTarget.current) {
      listenTarget.current = null;
      audio.pause();
    }
    setListeningTo(null);
  };

  const listen = (tune: Tune) => {
    listenTarget.current = tune.id;
    following.current = false;
    setListeningTo(tune.id);
    video.pause();
    tuneFileUri(tune).then(
      (uri) => {
        if (listenTarget.current !== tune.id) {
          return;
        }
        loadAudio(audio, uri, loadedUri);
        startAudio(audio, 0, false, 1);
        played.current = true;
      },
      () => {
        if (listenTarget.current === tune.id) {
          listenTarget.current = null;
          setListeningTo(null);
        }
      }
    );
  };

  return { listeningTo, listen, stopListening };
}
