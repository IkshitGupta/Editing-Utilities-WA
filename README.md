# Walnut Academy app

An Android app for Walnut Academy, Jaipur. It edits school photos, videos and notices on the phone and hands them to WhatsApp Business, Facebook and YouTube for posting. Everything runs on the phone: there is no server, no sign-in, no API key and no running cost.

- [User guide](docs/user-guide.md): installing the app, setting up the class Communities, and everyday use.
- [Building and releasing](docs/release.md): EAS builds, over-the-air updates, the signing key and Android developer verification.

## What it does

| Need                                                      | How the app handles it                                                                                                                                                                                                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Send photos, videos and notices to each class on WhatsApp | Each class is a WhatsApp Community, and only the school posts in its announcement group. The app opens WhatsApp Business with up to 100 photos and videos attached; the school ticks up to 5 class Communities and taps Send.                                                        |
| Share notices                                             | Notice cards: a title, the date and the notice laid out on a branded image with the school logo, name, address and phone.                                                                                                                                                            |
| Publish to Facebook and YouTube                           | The app opens Facebook with the photos or video attached, or the YouTube app's upload screen with one video.                                                                                                                                                                         |
| Basic photo editing                                       | Crop to a shape, rotate, flip, text, rectangles, circles, arrows and lines, and the school logo, solid or as a watermark. Photos are saved at their original size, or as a YouTube thumbnail.                                                                                        |
| Basic video editing                                       | Trim, join clips, crop to a shape, rotate, mute or add music (13 built-in tunes, or a song from the phone), logo (solid or watermark) and caption, and a thumbnail from any frame. Videos keep the original's resolution (up to 4K) and detail; HDR is converted to standard colour. |

Class lists live in WhatsApp Communities rather than in the app, so parents' numbers stay in WhatsApp and parents can't see each other's numbers. Sending happens in the official apps, which keeps the school's number within WhatsApp's terms and needs no developer accounts; automatic sending would need the paid WhatsApp Business Platform and API approval from Meta and Google.

## Tech stack

- Expo SDK 57 (React Native 0.86, New Architecture, React Compiler), TypeScript and Expo Router
- NativeWind (Tailwind CSS) with small components in the style of React Native Reusables
- `@shopify/react-native-skia` for the photo editor, notice cards and video overlay images; `expo-image-manipulator` to decode and orient photos
- A local Expo module in Kotlin, `modules/school-media`: AndroidX Media3 Transformer for video export, and Android share intents
- `expo-video`, `expo-video-thumbnails`, `expo-audio` (music in the editor's preview), `expo-media-library`, `expo-image-picker`, `expo-document-picker`, `expo-sqlite` (settings), `expo-keep-awake` and `expo-updates`
- zod to validate settings and the video edit list
- Jest with `jest-expo` and React Native Testing Library; JUnit for the Kotlin render maths

## Project layout

```text
src/app/                Screens (Expo Router): Home, Media and Settings tabs, editors and Saved
src/features/           image-editor, video-editor, notice-card, overlays, media, share, settings
src/components/         Shared UI components
src/lib/                Small helpers: files, Skia, formatting, errors
src/school/defaults.ts  School name, address, phone and classes
src/theme/              Brand colours
modules/school-media/   Kotlin module: Media3 video export and share intents
plugins/                Expo config plugin that keeps native builds on the app's NDK
assets/                 Logo, app icon, splash screen, Noto Sans fonts and built-in music
scripts/                Branding and music generators, and the lockfile registry fix
__tests__/              Jest tests
docs/                   User guide and release steps
```

## Commands

| Command                   | What it does                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `npm start`               | Starts Metro for the development build                                                       |
| `npm test`                | Runs the Jest tests                                                                          |
| `npm run typecheck`       | Type-checks with TypeScript                                                                  |
| `npm run lint`            | Lints with ESLint                                                                            |
| `npm run format`          | Formats with Prettier                                                                        |
| `npm run lockfile:public` | Points `package-lock.json` at the public npm registry before an EAS build                    |
| `npm run branding`        | Regenerates the logo, icons and splash image from `assets/source` (needs Python with Pillow) |
| `npm run android`         | Builds and runs the app locally (needs JDK 17 and the Android SDK)                           |

## Working on the app

The app includes native Kotlin code, so it runs in a development build rather than Expo Go.

1. Install the current Node.js LTS, then run `npm ci`.
2. Make a development build once (see [docs/release.md](docs/release.md) for the EAS setup):

   ```sh
   npm run lockfile:public
   eas build -p android --profile development
   ```

   Install the APK it links to on an Android phone you use for testing. To build on your own computer instead, see [Building and testing locally](docs/release.md#building-and-testing-locally).

3. Run `npm start` and open the project from the development build. The phone and computer need to be on the same Wi-Fi network, or use `npx expo start --dev-client --tunnel`.

Changes to screens and logic reload straight away. Changes under `modules/school-media`, new native packages, and changes to `app.json` plugins or permissions need a new development build.

## Notes for maintainers

- **Media3 version.** `modules/school-media/android/build.gradle` pins Media3 to the version `expo-video` and `expo-audio` use (1.9.0 for SDK 57), so the app ships a single copy of Media3. `__tests__/media3-version.test.ts` fails if they drift apart; after an Expo upgrade, update the pin to match.
- **Package registry.** The npm registry configured on the development machine is a private mirror, and local installs record its URLs in `package-lock.json`. EAS can't reach the mirror, so run `npm run lockfile:public` after installing packages and before building. Local installs keep working, because npm swaps `registry.npmjs.org` for the configured registry.
- **Expo patch releases.** A few Expo packages had newer patch versions than the mirror offered at setup. Run `npx expo install --check`, then `npx expo install --fix` once the mirror has them, and rerun the tests.
- **Skia text.** Paragraph styles only get optional keys (`maxLines`, `ellipsis`, `heightMultiplier`, `shadows`) when they have a value, because Skia's native side reads every key that is present.
- **Location data.** The app doesn't request `ACCESS_MEDIA_LOCATION`. Edited photos are re-encoded by Skia without EXIF. Saved videos go through `OutputMetadata.kt`, which keeps only the orientation and, for a single clip, the slow-motion capture rate, and sets the creation time to the save time. This matters on every Android version: Android 10 and later hide standard GPS boxes and XMP from the app, but not text keys such as the location iPhones store.
- **Output quality.** Editing shouldn't make anything less sharp. Photos keep the cropped photo's own pixels, aligned to whole pixels (sources are capped at 4096 px), and are saved as JPEG quality 95. Videos keep the source resolution up to 4K and the source's bits per pixel in H.264 terms (HEVC and VP9 sources get 1.6 times, AV1 twice), with a floor for already-compressed clips, and AAC audio at 192 kbps. HDR is tone-mapped to SDR. Sharing apps shrink files themselves when they need to.
- **Media library access.** On Android 11 and later the app saves, lists and deletes its own items without media permissions, and Android confirms each deletion. Android 10 and older ask for storage access first. After a reinstall, Android no longer counts earlier saves as the app's own, so the Media tab offers **Allow access** to show them until the question has been answered on this installation. The answer is stored with the app's install time, because Android can restore the app's settings from a backup made by an earlier installation, for example on a new phone. The tab refreshes whenever the app comes back to the front, since access and the album can change in other apps; it only checks access then, because asking opens Android's permission screen, which itself counts as leaving the app.
- **Working copies.** Picked files, decoded photos, frames, overlay layers and renders live in the app's cache. Each is removed once the album has its own copy or the editor closes, and leftovers older than a day are cleared at start-up (`src/lib/files.ts`).
- **Built-in tunes.** `assets/music` holds the 13 tunes listed in `src/features/video-editor/tunes.ts`. `assets/music/CREDITS.md` records where each came from (FreePD's public-domain recordings, kept on the Internet Archive, and a tune arranged for the app), with file hashes, which is the evidence to give if YouTube or Facebook flags one by mistake. `scripts/make-music.py` rebuilds them on Windows (FFmpeg with Media Foundation's AAC encoder, FluidSynth and the GeneralUser GS sound bank). It brings every tune to about −16 LUFS; the arranged tune lasts a whole number of AAC frames and ends on a quiet beat, so it repeats without a gap. Copy the lengths it prints into `tunes.ts`. On the phone, `expo-asset` copies a tune into the cache the first time it's used (`ExponentAsset-…` files); these aren't working files, so the clean-up leaves them.
- **Music in the preview.** `expo-audio` plays the chosen music with the video, from the point the saved video would be at, following the rules in `src/features/video-editor/music-mix.ts`: the volumes, timing across joined clips and the 2-second closing fade. The music player holds audio focus while it plays (it takes focus again after pausing to load, which gives it up), and the video player is set to mix with it (`audioMixingMode`), so neither pauses the other. If another app takes the sound, the preview pauses; the hook checks the music player's live state on each position update, because the player's own reports can be out of date and stop once it pauses. Closing the editor gives the focus back even if the music never started, since expo-audio otherwise releases it only when playback stops. Drift over 250 ms is corrected, but only while the music is playing and at least a second after it last moved, so a slow phone isn't caught in a loop of corrections. After each jump the music needs a moment to start again while the video carries on (about half a second on the emulator; Bluetooth adds more), so the hook measures that gap and sends the next jump that much further; otherwise every correction would leave a gap that triggers the next one. The hook reads whether the video is playing from the player itself, because a clip opens in a new player and the old one's pause is never reported. `setAudioModeAsync` is deliberately not called, because on Android it also switches the speakerphone on, which changes how phone calls are routed. In the saved video the fade is a Media3 `GainProcessor` on the mixed sound (`VideoRenderer.kt`); it reports stretches at full volume a minute at a time, because Media3 1.9.0 overflows an `int` when the fade of a very long video is hours away.
- **Error messages.** `src/lib/errors.ts` shows the app's own messages as they are. Technical text, such as Java exceptions, status codes, file paths and JavaScript errors like `TypeError`, becomes a plain cause (full storage, low memory, no internet, no access, a missing file) or a general message. The full text goes to the log: `adb logcat -s ReactNativeJS`.
- **Splash logo size.** Android 12 and later show the start-up logo inside a 192 dp circle, so `imageWidth` in `app.json` is 150 to keep the whole shield inside it. A larger value crops the shield's corners.
- **NDK version.** `plugins/with-app-ndk-version.js` points libraries that don't name an NDK version, such as `expo-updates`, at the app's NDK, so builds need only NDK 27.1.12297006.
- **Kotlin records.** Records passed from JavaScript to the Kotlin module are marked `@OptimizedRecord`, like Expo's own modules, so Expo converts them without reflection.
- **Device testing.** The app has been tested on an Android 15 emulator. The [phone checklist](docs/release.md#phone-checklist) lists what still needs a real phone.
