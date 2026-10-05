# Building and releasing

The app is built in the cloud with Expo Application Services (EAS) and installed from an APK link, without a Play Store listing. Later changes to screens and logic reach the phone as over-the-air updates.

## One-time setup

1. Create a free account at [expo.dev](https://expo.dev), then install the EAS CLI and sign in:

   ```sh
   npm install -g eas-cli
   eas login
   ```

2. Link the project to EAS. This adds `extra.eas.projectId` and `owner` to `app.json`:

   ```sh
   eas init
   ```

3. Turn on over-the-air updates. This adds `updates.url` to `app.json`:

   ```sh
   eas update:configure
   ```

   The build profiles in `eas.json` already set the update channels, and `runtimeVersion` uses the fingerprint policy.

4. Make the first production build (see [Building](#building)). When EAS offers to generate an Android keystore, accept; EAS stores it and signs every later build with it.
5. Back up the signing key: run `eas credentials -p android`, choose the `production` profile and download the keystore. Keep the file and its passwords in a password manager. The download is saved in the project folder, where `.gitignore` keeps it out of Git; move it into the password manager rather than leaving it there. Android only installs an update over the existing app if it's signed with the same key.

## Android developer verification

Android requires apps installed outside the Play Store to come from a verified developer. This has applied in Brazil, Indonesia, Singapore and Thailand since 30 September 2026 and rolls out worldwide from 2027. A free limited distribution account covers this app: up to 20 devices, with no fee and no ID document.

1. Sign up for a limited distribution account in the Android Developer Console with a Google account that has 2-Step Verification, a Google payments profile and a contact email ([guide](https://developer.android.com/developer-verification/guides/limited-distribution)).
2. Register the package name `com.walnutacademy.admin`.
3. Add the SHA-256 fingerprint of the signing key, shown by `eas credentials -p android`.
4. Authorise the school phone with the console's QR code or link.

Installing over USB with `adb install` isn't affected, which helps while testing.

## Build profiles

| Profile       | Use                                                                  | Update channel |
| ------------- | -------------------------------------------------------------------- | -------------- |
| `development` | Development build for `npm start`                                    | `development`  |
| `preview`     | Test copy of the app                                                 | `preview`      |
| `production`  | The copy on the school phone; the version code goes up automatically | `production`   |

All three produce an APK with the same package name, so a development or preview build replaces the installed app. Install them on a test phone, not the school phone.

## Building

```sh
npm run lockfile:public
npm test
npm run typecheck
npm run lint
eas build -p android --profile production
```

`lockfile:public` points `package-lock.json` at the public npm registry, which EAS can reach. When the build finishes, EAS prints a link and QR code for the APK. The free EAS plan includes a limited number of Android builds each month; over-the-air updates don't use them.

## Building and testing locally

Local builds need JDK 17 and an Android SDK with `platforms;android-36`, `build-tools;36.0.0`, `ndk;27.1.12297006` and `cmake;3.22.1`.

1. Generate the native project. `android/` is git-ignored and can be regenerated at any time:

   ```sh
   npx expo prebuild -p android
   ```

2. Point Gradle at the SDK, with `ANDROID_HOME` or a line in `android/local.properties`:

   ```properties
   sdk.dir=C\:\\Android\\Sdk
   ```

3. Build from the `android` folder:

   ```sh
   .\gradlew.bat assembleDebug -PreactNativeArchitectures=x86_64
   .\gradlew.bat assembleRelease
   ```

   The debug APK loads its JavaScript from Metro, which suits an emulator. The release APK (`android/app/build/outputs/apk/release/app-release.apk`) carries its JavaScript and runs on its own. Local builds are signed with a test key, so uninstall them before installing an EAS build on the same phone.

4. To run the debug build, start an emulator, install the APK with `adb install`, run `npm start` and open the project from the development build.

On Windows, Metro can keep reprocessing `node_modules` and never serve the app when Windows records file access times (`fsutil behavior query disablelastaccess` reports updates as enabled). Start Metro without file watching instead, and restart it after changing code:

```powershell
$env:CI = '1'; npm start
```

## Installing on the school phone

1. Open the APK link on the phone and download the file.
2. Open it and tap **Install**. If Android asks, allow the browser to install apps.
3. Open the app and allow access to photos and videos.

To install over USB instead, run `adb install path\to\app.apk`. A newer APK installs over the old one and keeps the settings.

## Over-the-air updates

For changes to screens, text and logic:

```sh
eas update --channel production --message "Describe the change"
```

The app downloads the update in the background when it opens and uses it from the next start. **Settings > Check for updates** applies it straight away.

Native changes need a new APK: the Kotlin module, native packages, `app.json` plugins or permissions, and Expo SDK upgrades. The runtime version is a fingerprint of the native code, so an update only reaches builds with matching native code. After a native change, build and install a new APK, then publish updates as usual.

## Phone checklist

The app was tested on an Android 15 emulator on 1 October 2026:

- photo editing and saving
- notice cards
- video trimming, joining, music and export
- thumbnails from rotated videos
- the Media tab, the share sheet and the YouTube upload hand-off
- settings and permissions

These still need a real phone:

- [ ] Save a 2–3 minute video and note how long it takes and how big the file is. The emulator encodes in software, so its timings don't apply.
- [ ] If the phone records 4K, save a 4K video and check it plays. A phone that can't encode 4K should save at a smaller size instead of failing.
- [ ] Compare an edited photo and video with the originals at full size; they should look equally sharp.
- [ ] Open the app and check the whole logo shows on the start-up screen.
- [ ] Share 20–30 photos at once to WhatsApp Business and to Facebook, and check Facebook posts as the school Page.
- [ ] Share a video to YouTube, sign in and upload it.
- [ ] Pinch to zoom a photo and to resize text.
- [ ] Save a thumbnail from a portrait video recorded on the phone and check it's the right way up.
