# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Librum" — an Expo / React Native (Expo Router) mobile app for library/coaching-center owners to manage members, batches, seats, admissions, and payments.

## Commands

```bash
npm start          # expo start (dev server, scan QR or press a/w)
npm run android    # expo start --android
npm run ios        # expo start --ios
npm run web        # expo start --web
```

There is no configured lint, test, or typecheck script in `package.json`. To typecheck manually, run `npx tsc --noEmit`. There are no test files in the repo currently.

## Environment

`EXPO_PUBLIC_API_URL` (read in `src/services/api/client.ts`) is the backend base URL, set via `.env` (e.g. `http://192.168.1.9:8000` for local backend on the LAN). Any env var exposed to client code must be prefixed `EXPO_PUBLIC_` per Expo convention.

## Architecture

### Routing (`app/`)

Uses **Expo Router** (file-based routing) with typed routes enabled. Route groups:
- `app/(auth)/` — login, OTP, register (unauthenticated flow)
- `app/(app)/` — authenticated flow: a `Stack` whose first child is `(tabs)/`, the bottom tab bar (home, members, payments, reports, notifications — labelled "Alerts", with an unread badge from `features/notifications/logic/unread-count.ts`). Every other screen (member detail, admission, batches, seats, settings — reached from Home's profile button —, attendance, renewals, subscription, library profile, …) sits beside `(tabs)` in the stack, so it opens full-screen over the tab bar. Groups don't change URLs, so `/members` is the tab and `/members/[id]` the pushed detail. The tab bar is Expo Router's **native tabs** (`expo-router/native-tabs`: UITabBarController on iOS, Material bottom navigation on Android) with SF Symbols on iOS and Ionicons on Android; the layout provides `InTabsContext`. On a tab screen `ScreenHeader` hides its back button unless given `onBack`, and bottom padding must come from `useScreenBottomInset()` rather than `insets.bottom`: on iOS a tab screen's inset already includes the translucent bar (automatic scroll insets are off so it isn't doubled), on Android native tabs pad the screen themselves so it's 0.
- `app/index.tsx` — entry point that decides where to redirect based on onboarding + auth state
- `app/onboarding.tsx` — first-run onboarding, gated by `getOnboardingComplete()`

Route files under `app/` are thin: each one just renders the corresponding screen component from `src/features/<name>/ui/`. Routing/navigation logic and redirects live in `app/`; feature UI and business logic live in `src/`.

Boot sequence in `app/_layout.tsx`: wait for fonts to load → read onboarding flag from `AsyncStorage` → hide splash screen → mount `ThemeProvider` → mount `BootstrapProvider` (exposes `onboardingComplete` via context) → render the root `Stack`.

### Feature module structure (`src/features/<feature>/`)

Each feature follows the same three-folder convention:
- `logic/` — API calls and feature-local business logic (e.g. `admission-api.ts`, `onboarding-storage.ts`)
- `types/` — TypeScript interfaces/types for that feature (some currently hold dummy/mock data alongside types, e.g. `members.types.ts` exports `DUMMY_MEMBERS`)
- `ui/` — the screen component itself (e.g. `MembersScreen.tsx`), imported directly into the matching `app/` route file

Cross-feature/shared API helpers live in `src/services/api/` (`client.ts` for the generic fetch wrapper, `auth.api.ts` for auth-token storage and login/logout). Feature-specific API calls (e.g. `src/features/admission/logic/admission-api.ts`) import `apiFetch`/`apiPost` from `src/services/api/client.ts` and pull the bearer token via `getStoredAuthToken()` from `src/services/api/auth.api.ts`.

Path aliases (`tsconfig.json`): `@/*` → repo root, `@/features/*` → `src/features/*`, `@/services/*` → `src/services/*`, `@/shared/*` → `src/shared/*`.

### Push notifications (`src/services/push/`)

**Never `import * as Notifications from "expo-notifications"` directly — use `Notifications` from `src/services/push/notifications-module.ts`** (null where unavailable; `import type` from the package is fine). Expo Go on Android has had no remote push since SDK 53, and there the package's entry throws "Cannot find native module 'ExpoTopicSubscriptionModule'" as soon as it's loaded. The wrapper skips loading it in that one environment, so the app runs without push in Expo Go on Android; iOS Expo Go and development/store builds get push as normal. To test push on Android, use a development build (`npx expo run:android` or an EAS development build).

### API client (`src/services/api/client.ts`)

Minimal fetch wrapper: `apiFetch<T>(path, init)` and `apiPost<T>(path, body, init)`. Base URL comes from `EXPO_PUBLIC_API_URL`. Responses are parsed as JSON and non-OK responses throw `Error(json.message ?? statusText)`. There is no shared auth-header injection in the client — each caller is responsible for attaching `Authorization: Bearer <token>` itself (see `admission-api.ts`, `auth.api.ts`'s `logoutApi`).

Auth state (`token`, `user`) is persisted to `AsyncStorage` under keys defined in `src/shared/constants/storage.ts` (`STORAGE_KEYS`), not in React context — screens call `getStoredAuthToken()` / `getStoredAuthUser()` directly when needed.

### Theming (`src/shared/providers/ThemeProvider.tsx` + `src/shared/constants/theme.ts`)

App-wide theme is a React context (`useTheme()` → `{ theme, mode, setMode, isDark }`), not Tailwind/nativewind class-based theming. `mode` is `"light" | "dark" | "system"`, persisted to `AsyncStorage` (key `app_theme_mode`), defaulting to following the OS scheme. The `Theme` interface and the `light`/`dark` palettes live in `src/shared/constants/theme.ts`.

Screens consume theme values via `useTheme().theme` and build their `StyleSheet.create(...)` styles from them (typically through a local `createStyles(theme)` function); there is no `className` styling. nativewind/Tailwind are still in `package.json` (with `global.css`, `postcss.config.mjs`) but are deliberately **not** wired into `babel.config.js`/`metro.config.js`: `nativewind/babel` rewrites `react-native` imports inside `node_modules` too, which on SDK 58 crashed startup (`react-native-worklets` got a half-loaded wrapper → "Cannot read property 'get' of undefined"). When adding new screens, match the existing `StyleSheet` + `useTheme()` pattern already used throughout `src/features/*/ui/*Screen.tsx` rather than introducing className-based styling, unless asked otherwise.

**Import `Text` and `TextInput` from `@/shared/ui/Text`, never from `react-native`.** The wrappers set `allowFontScaling={false}` so text renders at its styled size whatever the phone's system text-size setting — many Android phones default above 100%, which made Android look bigger than iOS. (`Text.defaultProps` can't do this: React 19 ignores defaultProps on function components.) Tab labels use `tabBarAllowFontScaling: false`; icons from `@expo/vector-icons` already don't scale. Opt a single element back in with `allowFontScaling`.

Lists use **FlashList** (`@shopify/flash-list` v2) for screen-sized lists; flatten sections into one array with a `type` per item and pass `getItemType`, `stickyHeaderIndices` for sticky headings, and `extraData` for any state a row shows besides its item. Small lists inside modal sheets and horizontal pagers stay `FlatList`. Images use **`expo-image`** (`contentFit`, not `resizeMode`), not React Native's `Image`. Rupee amounts go through `formatRupee` in `src/shared/utils/currency.ts` (one shared `Intl.NumberFormat`).

Fonts are the "Inter" family (`assets/fonts/Inter-*.ttf`, OFL licence alongside), loaded once in `app/_layout.tsx` under keys `sans-regular` / `sans-bold` / `sans-medium` / `sans-semibold` / `sans-extrabold` / `sans-light`, referenced in styles via `fontFamily`.
