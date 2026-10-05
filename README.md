# Walnut Academy app

An Android app for Walnut Academy, Jaipur. It edits school photos, videos and notices on the phone and hands them to WhatsApp Business, Facebook and YouTube for posting. Everything runs on the phone: there is no server, no sign-in, no API key and no running cost.

- [User guide](docs/user-guide.md): installing the app, setting up the class Communities, and everyday use.
- [Building and releasing](docs/release.md): EAS builds, over-the-air updates, the signing key and Android developer verification.

## What it does

| Need                                                      | How the app handles it                                                                                                                                                                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Send photos, videos and notices to each class on WhatsApp | Each class is a WhatsApp Community, and only the school posts in its announcement group. The app opens WhatsApp Business with up to 100 photos and videos attached; the school ticks up to 5 class Communities and taps Send. |
| Share notices                                             | Notice cards: a title, the date and the notice laid out on a branded image with the school logo, name, address and phone.                                                                                                     |
| Publish to Facebook and YouTube                           | The app opens Facebook with the photos or video attached, or the YouTube app's upload screen with one video.                                                                                                                  |
| Basic photo editing                                       | Crop to a shape, rotate, flip, text, rectangles, circles, arrows and lines, and the school logo, solid or as a watermark. Photos are saved at their original size, or as a YouTube thumbnail.                                 |
| Basic video editing                                       | Trim, join clips, crop to a shape, turn, mute or add music, logo (solid or watermark) and caption, and a thumbnail from any frame. Videos keep the original's resolution and quality.                                         |

Class lists live in WhatsApp Communities rather than in the app, so parents' numbers stay in WhatsApp and parents can't see each other's numbers. Sending happens in the official apps, which keeps the school's number within WhatsApp's terms and needs no developer accounts; automatic sending would need the paid WhatsApp Business Platform and API approval from Meta and Google.

## Tech stack

- Expo SDK 57 (React Native 0.86, New Architecture, React Compiler), TypeScript and Expo Router
- NativeWind (Tailwind CSS) with small components in the style of React Native Reusables
- `@shopify/react-native-skia` for the photo editor, notice cards and video overlay images; `expo-image-manipulator` to decode and orient photos
- A local Expo module in Kotlin, `modules/school-media`: AndroidX Media3 Transformer for video export, and Android share intents
- `expo-video`, `expo-video-thumbnails`, `expo-media-library`, `expo-image-picker`, `expo-document-picker`, `expo-sqlite` (settings), `expo-keep-awake` and `expo-updates`
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
assets/                 Logo, app icon, splash screen and Noto Sans fonts
scripts/                Branding generator and lockfile registry fix
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

- **Media3 version.** `modules/school-media/android/build.gradle` pins Media3 to the version `expo-video` uses (1.9.0 for SDK 57), so the app ships a single copy of Media3. `__tests__/media3-version.test.ts` fails if the two drift apart; after an Expo upgrade, update the pin to match.
- **Package registry.** The npm registry configured on the development machine is a private mirror, and local installs record its URLs in `package-lock.json`. EAS can't reach the mirror, so run `npm run lockfile:public` after installing packages and before building. Local installs keep working, because npm swaps `registry.npmjs.org` for the configured registry.
- **Expo patch releases.** A few Expo packages had newer patch versions than the mirror offered at setup. Run `npx expo install --check`, then `npx expo install --fix` once the mirror has them, and rerun the tests.
- **Skia text.** Paragraph styles only get optional keys (`maxLines`, `ellipsis`, `heightMultiplier`, `shadows`) when they have a value, because Skia's native side reads every key that is present.
- **Location data.** The app doesn't request `ACCESS_MEDIA_LOCATION`, so Android leaves location details out when the app reads photos and videos. Edited photos are re-encoded by Skia and videos by Media3.
- **Output quality.** Editing shouldn't make anything less sharp. Photos keep the cropped photo's own pixels (sources are capped at 4096 px) and are saved as JPEG quality 95. Videos keep the source resolution up to 4K and the source's bits per pixel, with a floor for already-compressed clips, and AAC audio at 192 kbps. Sharing apps shrink files themselves when they need to.
- **Splash logo size.** Android 12 and later show the start-up logo inside a 192 dp circle, so `imageWidth` in `app.json` is 150 to keep the whole shield inside it. A larger value crops the shield's corners.
- **NDK version.** `plugins/with-app-ndk-version.js` points libraries that don't name an NDK version, such as `expo-updates`, at the app's NDK, so builds need only NDK 27.1.12297006.
- **Kotlin records.** Records passed from JavaScript to the Kotlin module are marked `@OptimizedRecord`, like Expo's own modules, so Expo converts them without reflection.
- **Device testing.** The app has been tested on an Android 15 emulator. The [phone checklist](docs/release.md#phone-checklist) lists what still needs a real phone.
