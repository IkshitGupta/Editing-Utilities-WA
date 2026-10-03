import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..');

function media3Version(buildGradle: string, pattern: RegExp): string | undefined {
  return readFileSync(join(root, buildGradle), 'utf8').match(pattern)?.[1];
}

// Android apps must use one Media3 version; expo-video brings its own, so the video module follows it.
describe('Media3 version', () => {
  it('matches the version used by expo-video', () => {
    const expoVideo = media3Version(
      'node_modules/expo-video/android/build.gradle',
      /androidxMedia3Version\s*=\s*["']([^"']+)["']/
    );
    const schoolMedia = media3Version(
      'modules/school-media/android/build.gradle',
      /media3Version\s*=\s*["']([^"']+)["']/
    );
    expect(expoVideo).toBeDefined();
    expect(schoolMedia).toBe(expoVideo);
  });
});
