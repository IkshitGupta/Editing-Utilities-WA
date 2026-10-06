import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

import type { MusicChoice } from './edit-list';

export type TuneMood = 'cheerful' | 'playful' | 'birthday' | 'gentle' | 'heartfelt' | 'energetic';

export const TUNE_MOODS: readonly { id: TuneMood; label: string }[] = [
  { id: 'cheerful', label: 'Cheerful' },
  { id: 'playful', label: 'Playful' },
  { id: 'birthday', label: 'Birthday' },
  { id: 'gentle', label: 'Gentle' },
  { id: 'heartfelt', label: 'Heartfelt' },
  { id: 'energetic', label: 'Energetic' },
];

export type Tune = {
  id: string;
  mood: TuneMood;
  title: string;
  durationMs: number;
  source: number;
};

// Instrumentals bundled with the app: public-domain recordings and a tune arranged for the app.
// assets/music/CREDITS.md records where each one came from, and scripts/make-music.py rebuilds the
// files.
export const TUNES: readonly Tune[] = [
  {
    id: 'cheerful-happy-whistling-ukulele',
    mood: 'cheerful',
    title: 'Happy Whistling Ukulele',
    durationMs: 121_905,
    source: require('@/assets/music/cheerful-happy-whistling-ukulele.m4a'),
  },
  {
    id: 'cheerful-ukulele-song',
    mood: 'cheerful',
    title: 'Ukulele Song',
    durationMs: 136_069,
    source: require('@/assets/music/cheerful-ukulele-song.m4a'),
  },
  {
    id: 'cheerful-pickled-pink',
    mood: 'cheerful',
    title: 'Pickled Pink',
    durationMs: 174_660,
    source: require('@/assets/music/cheerful-pickled-pink.m4a'),
  },
  {
    id: 'playful-and-just-like-that',
    mood: 'playful',
    title: 'And Just Like That',
    durationMs: 108_646,
    source: require('@/assets/music/playful-and-just-like-that.m4a'),
  },
  {
    id: 'playful-my-giant-bunny-friend',
    mood: 'playful',
    title: 'My Giant Bunny Friend',
    durationMs: 162_075,
    source: require('@/assets/music/playful-my-giant-bunny-friend.m4a'),
  },
  {
    id: 'playful-hopeful',
    mood: 'playful',
    title: 'Hopeful',
    durationMs: 111_409,
    source: require('@/assets/music/playful-hopeful.m4a'),
  },
  {
    id: 'birthday-happy-birthday',
    mood: 'birthday',
    title: 'Happy Birthday',
    durationMs: 34_203,
    source: require('@/assets/music/birthday-happy-birthday.m4a'),
  },
  {
    id: 'gentle-pond',
    mood: 'gentle',
    title: 'Pond',
    durationMs: 149_978,
    source: require('@/assets/music/gentle-pond.m4a'),
  },
  {
    id: 'gentle-connecting-rainbows',
    mood: 'gentle',
    title: 'Connecting Rainbows',
    durationMs: 115_891,
    source: require('@/assets/music/gentle-connecting-rainbows.m4a'),
  },
  {
    id: 'gentle-painting-room',
    mood: 'gentle',
    title: 'Painting Room',
    durationMs: 101_030,
    source: require('@/assets/music/gentle-painting-room.m4a'),
  },
  {
    id: 'heartfelt-motions',
    mood: 'heartfelt',
    title: 'Motions',
    durationMs: 116_796,
    source: require('@/assets/music/heartfelt-motions.m4a'),
  },
  {
    id: 'heartfelt-inspiration',
    mood: 'heartfelt',
    title: 'Inspiration',
    durationMs: 135_442,
    source: require('@/assets/music/heartfelt-inspiration.m4a'),
  },
  {
    id: 'energetic-city-sunshine',
    mood: 'energetic',
    title: 'City Sunshine',
    durationMs: 182_207,
    source: require('@/assets/music/energetic-city-sunshine.m4a'),
  },
];

export function findTune(id: string): Tune | undefined {
  return TUNES.find((tune) => tune.id === id);
}

// The app copies a bundled tune into its cache before it can be played or saved. The copy is
// reused, and made again if Android has cleared the cache since.
export async function tuneFileUri(tune: Tune): Promise<string> {
  const asset = Asset.fromModule(tune.source);
  if (asset.downloaded && asset.localUri && !new File(asset.localUri).exists) {
    asset.downloaded = false;
  }
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error('This tune could not be opened. Choose another one.');
  }
  return asset.localUri;
}

export async function musicFileUri(music: MusicChoice): Promise<string> {
  if (music.kind === 'file') {
    return music.uri;
  }
  const tune = findTune(music.tuneId);
  if (!tune) {
    throw new Error('This tune is no longer available. Choose another one.');
  }
  return tuneFileUri(tune);
}
