# 60-in-60

A calmer kind of math arcade. An Expo / React Native app for iOS, Android, and web, with a forest-green, mint, and coral identity and encouraging practice for every age.

Version **2.0.0** replaces timed modes with **untimed, 20-card sets**, personal recall tracking, and grids of facts known **by heart**. The supplied redesign plan and HTML mockup guide the Home, world, countdown, and results layouts.

## Play

All seven worlds are available: addition, subtraction, addition + subtraction, multiplication, division, multiplication + division, and all four operations. Each offers numbers **1–5, 1–10, and 1–12**. There is one practice flow, with no deadline or failure screen.

- A breathing 3–2–1 countdown takes about one second per number. Tap anywhere to skip it. Reduced-motion preferences are respected.
- Answers submit automatically after the expected number of digits. Backspace edits an incomplete answer. Web players can also use the number keys and Backspace.
- Correct answers advance immediately. The small success check does not block input or clear the next answer.
- A miss keeps the card, the entered answer, a red X, and the correct answer visible until **Next** is tapped. A set always continues to its last card.
- Results show accuracy, answer time, median recall time, and comparable figures from the player's previous set in the same range. Wins appear only when supported by actual progress. Misses include the exact typed answer and a derived-fact strategy.
- **Practice missed (n)** revisits the distinct missed facts in a targeted n-card set and never earns daily recall credit. **Another set** or **Keep going** starts a normal 20-card set; **Done** returns Home.
- Results buttons wait 900 ms and for 450 ms of quiet after leftover taps or held presses. The keypad sits an additional 32 px inside the native safe area and adapts to shorter screens.

Each operation has 144 distinct facts, shared across ranges and mixed worlds. Grid coordinates are the two positive source numbers a and b, from 1 to 12. Addition is a + b; multiplication is a × b; subtraction is (a + b) − b; division is (a × b) ÷ b. Thus subtraction and division each fill a complete square with positive, exact answers.

## Facts by heart

The four Home grids show **Not yet**, **Learning**, **Almost**, and **By heart**, using white, #DDEFCB, #8FC49C, and #37734E. A single-operation world shows its full grid with numbered axes and gaps after 5 and 10. Mixed worlds contribute to the same four grids. Each world recommends its smallest range that is not currently all By heart.

A clean recall is correct, uses no backspace, and begins within the player's recall bar. Only a fact's first presentation on a local calendar day can earn credit. Presentation is saved even if a player leaves the set before answering, so returning does not create another first-sight opportunity.

| State | Meaning |
| --- | --- |
| Not yet | Never presented |
| Learning | Presented, with no clean days |
| Almost | One or two clean days |
| By heart | Three clean days |

A clean first-ever answer earns By heart immediately, with an initial check-in due on day 3. Otherwise, three separate clean days are needed; they need not be consecutive. Same-day repeats and Practice missed earn no credit. A miss or a slower answer on a By heart fact moves it to two clean days. Slips do not subtract days from Learning or Almost facts.

Reviews are scheduled for days **3, 7, 21, and 60 after earning By heart**, with 60-day maintenance reviews thereafter. A successful late check-in skips milestones already in the past. Early practice and same-day repeats do not advance the schedule. Regaining By heart after a slip starts a new review schedule.

Before ten correct calibration answers exist, the recall bar is 3000 ms for players under 13 and 2000 ms for players 13 and up. A player whose birth year has not yet been entered uses 3000 ms. Thereafter, it is the median first-key time on correct +1, ×1, and addition-doubles facts, plus 1000 ms, capped at 3000 ms. Each newly presented card uses the current calibrated bar. Calibration retains its eligible samples so the median remains exact across reloads.

Answer records include the canonical fact key, numeric and exact typed answers, correctness, first-key time, submission time, backspace use, and presentation credit context. First-key times above 20 seconds are excluded from timing statistics and calibration. Results time is the sum of eligible answer submission times, excluding correction-reading pauses; per-fact time is median first-key recall time.

A range trophy is earned when every fact in its square is currently By heart. It stays earned after slips, while live grid counts show current recall. Home has twelve trophies across the four operations. A mixed-world range badge requires the earned badges for each of its operations.

## Family profiles and upgrade

Parents can add, edit, switch, and remove players in Family. Each has their own avatar, color, birth year, recall calibration, facts, trophies, and recent sets. Names have a 20-character limit. Family shows age computed from birth year. Removing a player asks for confirmation, and the final player cannot be removed through the UI. Gentle haptics can be switched off.

**The 2.0.0 upgrade intentionally resets old timed progress and history.** Player identities, names, avatars, colors, and device settings are retained. No old timed achievements are converted into recall credit. The storage schema is versioned so subsequent reloads retain the new progress rather than resetting it again. Existing players can add a birth year in Family.

Data stays on this device with AsyncStorage. There are no accounts, ads, leaderboards, cloud sync, or parent authentication. The most recent 100 completed sets are retained per player; fact progress and earned trophies persist beyond that limit. Writes are serialized to prevent older saves overwriting newer ones. The sanitizer validates facts, dates, calibration samples, birth years, history, and trophy IDs before restoring them.

## Develop

Requirements: Node 20.19.4 or later, npm, and Chromium for browser tests. This environment uses Node 24.19.0. Expo SDK 54, React 19.1, and React Native 0.81.5 are fixed by `package-lock.json`.

```sh
cd /workspace/codex-test
npm ci --no-audit --no-fund
npm run web -- --port 8081 --max-workers 2
```

Metro uses the supported Expo offline mode and local bundled fonts. Gameplay needs no backend or secret. Installation uses the npm registry with normal TLS and package integrity checks. Expo state and npm caches are stored in ignored project-local directories so the cloud workflow supports a read-only home directory.

On a workstation, `npm start` starts Expo and `npm run ios` / `npm run android` use installed compatible simulators. Use a client compatible with Expo SDK 54 or a standalone native build. This Linux cloud instance has no Xcode/iOS simulator or Android SDK/emulator.

## Verify

```sh
npm run typecheck
npm test
npm run test:e2e
EXPO_OFFLINE=1 npm run build -- --max-workers 2
```

Unit checks cover full arithmetic banks, set completion, answer timing, clean recall, daily credit, first sight, slips, review dates, calibration, picker buckets, mixed balancing, earned trophies, profile migration, sanitization, and truthful coaching. Calendar behavior is also checked with `TZ=America/New_York npm test`.

Playwright checks exercise real 20-card sets, held mistakes and Next, targeted practice, persistent grids and trophies, family editing and isolation, the countdown, results tap protection, and legacy migration. Layout checks cover 344×740 and 768×720 with simulated native safe-area insets, plus a 1440 px desktop. Chromium is `/usr/bin/chromium` here; `CHROMIUM_PATH` can select another installed binary. The runner starts Metro or reuses an existing server.

The export command produces web JavaScript and native iOS/Android Hermes bundles in ignored `dist/`. **Bundle exports and browser checks are not signed APK builds or physical-phone tests.**

## Native distribution

The app is linked to [@nutmagpie/60-in-60 on Expo](https://expo.dev/accounts/nutmagpie/projects/60-in-60). Android package `com.sixtyin60.game` and the existing remote signing credentials are retained. Version 2.0.0 uses Android versionCode 4. The `preview` EAS profile produces an internal standalone APK; the iOS preview profile produces a simulator build.

```sh
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform all --profile production
```

Build/account operations use `api.expo.dev`, source uploads use `storage.googleapis.com`, and public install/artifact links use `expo.dev`. An Expo account and signing access are needed only for native distribution. Earlier public artifact downloads in this cloud environment returned HTTP 403; this does not imply missing build credentials.

Expo accepted [Android 2.0.0 build b6dc2741-855d-473e-8c46-1236fccfe7d1](https://expo.dev/accounts/nutmagpie/projects/60-in-60/builds/b6dc2741-855d-473e-8c46-1236fccfe7d1) from source commit `013f03f99463f1dccb3040fc535877ec84c49b7a`, using the existing remote keystore. It is waiting for an Expo worker; download its APK from that record once it says **Finished**. Previous 1.0.x APKs contain the timed game and do not contain this redesign.

Validated for this release: TypeScript, all 33 unit tests (including local calendar checks with `TZ=America/New_York`), all 15 browser tests, and web/iOS/Android bundle exports. The new signed APK remains pending; its signature and physical-device installation have not been tested here.

### Install on Android

1. Open the new build record on the phone, wait for **Finished**, and download its APK.
2. Open the downloaded file. If Android prompts, allow installation from that browser or file manager, then choose **Update** over the existing app. Player identities remain; old timed progress resets as described above.
3. Open **60-in-60** and choose a player. It works offline, without a MacBook, Expo Go, or development server.

Production iOS builds require Apple signing, and Android store submission requires a Play Console app. Store submission has not been completed.

## Source map

- `App.tsx`: navigation, profile ownership, font setup, persistence, and set lifecycle.
- `src/game.ts`: canonical fact banks and the pure untimed set engine.
- `src/recall.ts`: calendar credit, recall states, calibration, reviews, trophies, and fact selection.
- `src/FactGrid.tsx`: real grids, axis/range spacing, legend, and trophy pills.
- `src/coaching.ts`: truthful wins, conditional coaching, and derived-fact strategies.
- `src/Lobby.tsx`: Home, worlds/ranges, Progress, and How to play.
- `src/Play.tsx`: breathing countdown, flash cards, number pad, corrections, and results.
- `src/profileModel.ts` / `src/profiles.ts`: player model, validation, migration, and serialized storage.
- `src/Family.tsx`: birth year, player management, settings, and profile selection.
- `src/ui.tsx` / `src/art.tsx`: shared controls, typography, and original brand illustrations.

Cloud tasks are already isolated. Use the existing checkout rather than creating another Git worktree unless explicitly requested.
