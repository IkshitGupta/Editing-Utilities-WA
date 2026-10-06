import type { VideoPlayer } from 'expo-video';

// Player changes live outside components so React Compiler can keep optimising the editor,
// which treats values returned from hooks as read-only.

// Lands on the whole millisecond nearest to `ms`. Android drops the fraction when it converts the
// time, which could otherwise land one millisecond early and show the frame before.
export function seekTo(player: VideoPlayer, ms: number) {
  player.currentTime = (Math.round(Math.max(0, ms)) + 0.5) / 1000;
}

// Read at the moment it's needed: position events arrive only every 200 ms and not after a seek.
// Rounded, because the player reports whole milliseconds through a lower-precision number.
export function currentTimeMs(player: VideoPlayer): number {
  return Math.round(player.currentTime * 1000);
}

// A level of 0 mutes the video's own sound.
export function setSoundLevel(player: VideoPlayer, level: number) {
  player.volume = Math.max(0, level);
  player.muted = level <= 0;
}

// While music is chosen, the music player holds audio focus as it plays and the video mixes with
// it, so neither pauses the other. Otherwise the video takes audio focus as usual.
export function setMixesWithMusic(player: VideoPlayer, mixes: boolean) {
  const mode = mixes ? 'mixWithOthers' : 'auto';
  if (player.audioMixingMode !== mode) {
    player.audioMixingMode = mode;
  }
}

export function configurePlayer(player: VideoPlayer) {
  player.loop = false;
  player.timeUpdateEventInterval = 0.2;
}
