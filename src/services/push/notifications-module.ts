import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

type NotificationsModule = typeof import("expo-notifications");

/**
 * False in Expo Go on Android. Expo Go dropped remote push on Android in SDK 53, and there
 * `expo-notifications` can't even be loaded: its entry asks for ExpoTopicSubscriptionModule,
 * which Expo Go doesn't ship, and throws "Cannot find native module". A development build or
 * store build has it, so push works there.
 */
export const isPushAvailable = !(Platform.OS === "android" && isRunningInExpoGo());

/**
 * expo-notifications, or null where it can't load. Always import it from here, never directly:
 * a plain `import` runs the module at startup and crashes Expo Go on Android. (Type-only
 * imports, `import type ... from "expo-notifications"`, are fine anywhere.)
 */
export const Notifications: NotificationsModule | null = isPushAvailable ? require("expo-notifications") : null;
