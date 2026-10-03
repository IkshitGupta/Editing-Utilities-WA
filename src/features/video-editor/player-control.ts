import type { VideoPlayer } from 'expo-video';

// Player changes live outside components so React Compiler can keep optimising the editor,
// which treats values returned from hooks as read-only.

export function seekTo(player: VideoPlayer, ms: number) {
  player.currentTime = Math.max(0, ms) / 1000;
}

export function setMuted(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}

export function configurePlayer(player: VideoPlayer) {
  player.loop = false;
  player.timeUpdateEventInterval = 0.2;
}
