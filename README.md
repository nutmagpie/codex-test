# 60-in-60

A calmer kind of math arcade. An Expo / React Native app for iOS, Android, and web, with original artwork, a forest-green/mint/coral identity, and encouraging practice at every age.

## Play

Seven worlds are open from the start: addition, subtraction, addition + subtraction, multiplication, division, multiplication + division, and all four operations. Each has three levels: **1–5, 1–10, and 1–12**.

Each level has three modes:

| Mode | Cards | Time | Purpose |
| --- | --- | --- | --- |
| Learn | 20 | Untimed | Accuracy and getting comfortable with the facts |
| Speed | 30 | 45 seconds | Building fluency on the way to mastery |
| Mastery | 60 | 60 seconds | The original 60-in-60 challenge |

Each session has three hearts. A wrong answer costs one heart; the third miss ends the session. Complete every card before the deadline with at most two misses to pass. Mastery therefore needs at least **58 correct answers out of 60**. Finished runs retain their outcome; timed sessions cannot accept an answer at or after the deadline.

Answers submit automatically when the expected number of digits has been entered. Backspace can correct an incomplete answer. Single-digit answers submit immediately. Web players can also use the number keys and Backspace. No Enter button is needed.

In Speed and Mastery, correct answers advance to the next card immediately, with no input lock or forced transition delay. A brief success message stays below the new card for 450 ms without interrupting typing. Incorrect answers show a correction for 350 ms before advancing; the clock keeps running. Learn retains a 100 ms success pause and a 1.25-second correction pause.

Addition and multiplication use operands in the selected range. Subtraction keeps both operands in range and produces nonnegative answers (including zero). Division draws its divisor and quotient from the range and builds an exact dividend, so there are no fractions. Shuffled fact banks cover all facts before repeating, avoid adjacent duplicate questions, and balance mixed operations.

## Family profiles

The Family corner supports adding, editing, switching, and removing player profiles. Each player has their own avatar, color, mode completions, mastery collection, and history. Names have a 20-character limit. Removal uses a confirmation step; the last profile cannot be removed through the app.

Data is stored **on this device** with AsyncStorage. There are no accounts, ads, public scores, cloud sync, or parent authentication. The most recent 100 sessions are retained per player; mastery and per-level progress persist beyond that limit. Completed run IDs make progress updates idempotent. Gentle haptics can be turned off in Family settings and run on native devices only.

## Develop

Requirements: Node 20.19.4 or later (validated here with Node 24.19.0), npm, and Chromium for browser tests. Uses Expo SDK 54, React 19.1, and React Native 0.81.5; versions are fixed by `package-lock.json`.

```sh
cd /workspace/codex-test
npm ci --no-audit --no-fund
npm run web -- --port 8081 --max-workers 2
```

The web command starts Metro in offline mode: it serves the installed packages and bundled fonts without Expo API access. Package installation still uses the npm registry with normal TLS and integrity checks. The CLI wrapper stores Expo state in ignored `.expo/home` so it can run in a cloud environment with a read-only home directory. npm uses a project-local ignored cache.

For native development on a workstation, `npm start` opens the Expo development server, and `npm run ios` / `npm run android` launch installed compatible simulators. Use a client compatible with Expo SDK 54 or a native build; iOS simulator/Xcode and Android SDK/emulator are not provided by this Linux cloud instance. If using the cloud machine, `EXPO_OFFLINE=1 npm start -- --host localhost` starts Metro with existing packages without remote version discovery. There are no required secrets or backend services for gameplay.

## Verify

```sh
npm run typecheck
npm test
npm run test:e2e
EXPO_OFFLINE=1 npm run build -- --max-workers 2
```

- Unit tests exercise all arithmetic worlds/ranges, shuffling, digit counts, timing boundaries, the third-miss limit, 58-of-60 mastery, independent player progress, persistence validation, and bounded history.
- Playwright tests exercise the real UI at 390×844: keypad/backspace, heart limits, replay, a full mastery run, deadlines, and family profiles across reloads. Frozen-clock checks verify immediate timed transitions, preservation of partially entered answers, feedback timer replacement, and Learn pacing. The suite starts Metro if necessary. It uses `/usr/bin/chromium` in this cloud machine; set `CHROMIUM_PATH` to another installed binary when needed.
- `build` exports web JavaScript and iOS/Android Hermes bundles into ignored `dist/`. **Bundle export is not a signed native binary build or device test.**

## Native distribution

`app.json` includes app identity, portrait orientation, tablet support, native icons, and a URL scheme. `eas.json` includes an Android APK / iOS simulator preview profile and a production profile.

The project is linked to [@nutmagpie/60-in-60 on Expo](https://expo.dev/accounts/nutmagpie/projects/60-in-60). Android signing credentials are configured remotely in Expo. EAS source uploads require access to `storage.googleapis.com`; account/build operations use `api.expo.dev`, and installation links use `expo.dev`.

From a machine with an Expo account and the appropriate build access:

```sh
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform all --profile production
```

The version 1.0.1 timing update (Android build 2) is submitted to Expo as [build 48b4c0e6-5224-4831-85a8-3c61e21c262f](https://expo.dev/accounts/nutmagpie/projects/60-in-60/builds/48b4c0e6-5224-4831-85a8-3c61e21c262f). It removes the correct-answer transition delay in Speed and Mastery. The build is waiting for an Expo worker; once it finishes, download its APK from that build record to update the existing app.

The initial Android preview build (version 1.0.0), [f705e099-4dc7-4827-ba48-c3e6df8b2fa7](https://expo.dev/accounts/nutmagpie/projects/60-in-60/builds/f705e099-4dc7-4827-ba48-c3e6df8b2fa7), finished successfully. [Download its standalone APK](https://expo.dev/artifacts/eas/ws3ST-6Bxh7JUAWG4c0WBw3EiJqKYnuPpgBJKO52Y-I.apk). This older APK retains the original transition timing. The standalone app runs without a MacBook, Expo Go, or a development server.

The cloud environment could not download the finished APK: Expo's artifact endpoint returned HTTP 403, including through the official EAS download command. APK integrity/signature checks and physical-device installation have therefore not been verified here. Source tests and native bundle exports passed; Expo reports the native build as finished with no error.

The iOS preview profile produces a simulator build. Production iOS builds require Apple signing; Android store submission requires a Play Console app and signing configuration. Choose your own unique bundle identifiers before a store release. Store submission has not been completed.

### Install on Android

1. Open the APK download link on your Android phone and download the file.
2. Open the downloaded APK. If Android prompts, allow **Install unknown apps** / **Allow from this source** for the browser or file manager, then tap **Install** (or **Update** if already installed). Install updates over the existing app to keep its player profiles and progress.
3. Open **60-in-60** and create or choose a player profile. Gameplay works offline; profiles and progress stay on that device.

## Source map

- `App.tsx`: navigation, font initialization, profile loading, persistence, and session lifecycle.
- `src/game.ts`: pure arithmetic and session engine.
- `src/Lobby.tsx`: worlds, level/mode selection, progress, and instructions.
- `src/Play.tsx`: keypad, countdown, clock, heart feedback, and results.
- `src/profileModel.ts` / `src/profiles.ts`: pure profile model and serialized storage.
- `src/Family.tsx`: family management and player selection.
- `src/ui.tsx` / `src/art.tsx`: typography, shared controls, and vector brand illustrations.
- `assets/`: original app icon and favicon sources plus platform PNGs.

Cloud tasks are already isolated. Work in the existing checkout rather than creating another Git worktree unless explicitly requested.
