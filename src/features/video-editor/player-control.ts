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

export function setMuted(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}

export function configurePlayer(player: VideoPlayer) {
  player.loop = false;
  player.timeUpdateEventInterval = 0.2;
}
