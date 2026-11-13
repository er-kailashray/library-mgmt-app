import { Platform } from "react-native";

/**
 * Spread onto a `Switch` next to `thumbColor="#fff"`: React Native Web ignores thumbColor for the
 * "on" state and paints its own teal knob unless given `activeThumbColor` (not in RN's types).
 */
export const webWhiteThumb: object = Platform.OS === "web" ? { activeThumbColor: "#fff" } : {};
