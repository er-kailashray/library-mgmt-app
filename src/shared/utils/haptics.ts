import type * as HapticsModule from "expo-haptics";
import { Platform } from "react-native";

/**
 * Light physical feedback for taps that change something. Loaded defensively: a development build
 * made before expo-haptics was added has no native module, and the package throws on import there.
 * Without it (or on web) every call is a no-op.
 */
let Haptics: typeof HapticsModule | null = null;
if (Platform.OS !== "web") {
	try {
		Haptics = require("expo-haptics");
	} catch {
		Haptics = null;
	}
}

function run(effect: (haptics: typeof HapticsModule) => Promise<void>) {
	if (!Haptics) return;
	effect(Haptics).catch(() => {
		// Haptics off in system settings, or unsupported hardware: nothing to do.
	});
}

export const haptics = {
	/** Picking an option: a segment, a chip, a day. */
	selection: () => run((h) => h.selectionAsync()),
	/** A light tap for a small action: check-in, toggle. */
	light: () => run((h) => h.impactAsync(h.ImpactFeedbackStyle.Light)),
	/** Something saved or sent. */
	success: () => run((h) => h.notificationAsync(h.NotificationFeedbackType.Success)),
	/** Something went wrong. */
	error: () => run((h) => h.notificationAsync(h.NotificationFeedbackType.Error)),
	/** About to do something destructive. */
	warning: () => run((h) => h.notificationAsync(h.NotificationFeedbackType.Warning)),
};
