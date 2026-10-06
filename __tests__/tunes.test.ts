import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { TUNES, TUNE_MOODS, findTune, musicFileUri } from '@/features/video-editor/tunes';

const musicFolder = join(__dirname, '..', 'assets', 'music');

function bundledFile(id: string): string | undefined {
  const name = `${id}.m4a`;
  return existsSync(join(musicFolder, name)) ? name : undefined;
}

describe('built-in tunes', () => {
  it('offers 13 tunes, each with its own id, a title and a length', () => {
    expect(TUNES).toHaveLength(13);
    expect(new Set(TUNES.map((tune) => tune.id)).size).toBe(TUNES.length);
    for (const tune of TUNES) {
      expect(tune.title).not.toBe('');
      expect(tune.durationMs).toBeGreaterThan(5_000);
    }
  });

  it('lists the tunes mood by mood, with every mood represented', () => {
    const moods = TUNE_MOODS.map((mood) => mood.id);
    const order = TUNES.map((tune) => moods.indexOf(tune.mood));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(moods.length);
    expect(TUNES[0].mood).toBe('cheerful');
  });

  it('bundles a file for every tune and credits it', () => {
    const credits = readFileSync(join(musicFolder, 'CREDITS.md'), 'utf8');
    for (const tune of TUNES) {
      const file = bundledFile(tune.id);
      expect(file).toBeDefined();
      expect(credits).toContain(`\`${file}\``);
      expect(credits).toContain(`**${tune.title}**`);
    }
  });

  it('finds tunes by id', () => {
    expect(findTune(TUNES[1].id)).toBe(TUNES[1]);
    expect(findTune('no-such-tune')).toBeUndefined();
  });

  it('uses a song from the phone as it is', async () => {
    const song = {
      kind: 'file',
      uri: 'file:///cache/DocumentPicker/song.mp3',
      name: 'song.mp3',
    } as const;
    await expect(musicFileUri(song)).resolves.toBe(song.uri);
  });

  it('explains when a tune is no longer available', async () => {
    await expect(musicFileUri({ kind: 'tune', tuneId: 'no-such-tune' })).rejects.toThrow(
      'This tune is no longer available. Choose another one.'
    );
  });
});
