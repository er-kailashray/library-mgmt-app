import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RADIUS, FLOATING_SHADOW } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";
import { haptics } from "@/shared/utils/haptics";

export type ToastTone = "success" | "error" | "info";

export type ToastOptions = {
	message: string;
	/** Optional smaller second line. */
	detail?: string;
	tone?: ToastTone;
	/** A button on the toast, e.g. Undo or View. */
	action?: { label: string; onPress: () => void };
	/** Defaults to 3s, or 5s when there's an action to reach for. */
	durationMs?: number;
};

type ShownToast = ToastOptions & { id: number };

// One host per layer: the app's, plus one inside each open sheet (a sheet is its own native window,
// so the app's host would sit hidden behind it). The newest host shows the toast.
const hosts: ((toast: ShownToast) => void)[] = [];
let nextId = 1;

/**
 * Shows a short message at the top of the screen that goes away on its own (or with a swipe up).
 * For outcomes worth noting but not worth stopping for ("Reminder sent", "Saved"); use an alert
 * only when the owner has to decide something. Callable from anywhere, not just components.
 */
export function showToast(options: ToastOptions): void {
	hosts[hosts.length - 1]?.({ ...options, id: nextId++ });
}

const ICONS: Record<ToastTone, keyof typeof Ionicons.glyphMap> = {
	success: "checkmark-circle",
	error: "alert-circle",
	info: "information-circle",
};

/** How far above the screen the toast waits, hidden. */
const HIDDEN_Y = -160;

/** Renders the current toast; mounted at the root, and inside each BottomSheet so toasts show above it. */
export function ToastHost() {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const styles = createStyles(theme);
	const [toast, setToast] = useState<ShownToast | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const translateY = useSharedValue(HIDDEN_Y);
	const dragY = useSharedValue(0);

	const clear = useCallback(() => setToast(null), []);

	const hide = useCallback(() => {
		if (timer.current) clearTimeout(timer.current);
		translateY.value = withTiming(HIDDEN_Y, { duration: 220 }, (finished) => {
			if (finished) runOnJS(clear)();
		});
	}, [translateY, clear]);

	useEffect(() => {
		const show = (next: ShownToast) => {
			if (timer.current) clearTimeout(timer.current);
			dragY.value = 0;
			setToast(next);
			translateY.value = HIDDEN_Y;
			translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
			const tone = next.tone ?? "success";
			if (tone === "success") haptics.success();
			else if (tone === "error") haptics.error();
			timer.current = setTimeout(hide, next.durationMs ?? (next.action ? 5000 : 3000));
		};
		hosts.push(show);
		return () => {
			hosts.splice(hosts.indexOf(show), 1);
			if (timer.current) clearTimeout(timer.current);
		};
	}, [hide, translateY, dragY]);

	// Drag up to dismiss; a small drag springs back.
	const pan = Gesture.Pan()
		.onUpdate((e) => {
			dragY.value = Math.min(0, e.translationY);
		})
		.onEnd((e) => {
			if (e.translationY < -30 || e.velocityY < -500) {
				runOnJS(hide)();
			} else {
				dragY.value = withSpring(0);
			}
		});

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateY.value + dragY.value }],
		opacity: 1 + Math.max(-1, (translateY.value + dragY.value) / -HIDDEN_Y),
	}));

	if (!toast) return null;
	const tone = toast.tone ?? "success";
	const toneColor = tone === "success" ? theme.success : tone === "error" ? theme.destructive : theme.accent;

	return (
		<View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 8 }]}>
			<GestureDetector gesture={pan}>
				<Animated.View style={[styles.toast, animatedStyle]} accessibilityRole="alert" accessibilityLiveRegion="polite">
					<Ionicons name={ICONS[tone]} size={22} color={toneColor} />
					<View style={styles.text}>
						<Text style={styles.message}>{toast.message}</Text>
						{toast.detail ? <Text style={styles.detail}>{toast.detail}</Text> : null}
					</View>
					{toast.action && (
						<Pressable
							accessibilityRole="button"
							hitSlop={8}
							onPress={() => {
								toast.action?.onPress();
								hide();
							}}
							style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}>
							<Text style={styles.actionText}>{toast.action.label}</Text>
						</Pressable>
					)}
				</Animated.View>
			</GestureDetector>
		</View>
	);
}

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		// Always the dark surface, in both themes, so it reads as floating above the page.
		toast: {
			marginHorizontal: 16,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingVertical: 12,
			paddingHorizontal: 14,
			borderRadius: RADIUS.lg,
			backgroundColor: theme.primarySurface,
			borderWidth: 1,
			borderColor: "rgba(255,255,255,0.08)",
			...FLOATING_SHADOW,
		},
		text: {
			flex: 1,
		},
		message: {
			fontFamily: "sans-semibold",
			fontSize: 14,
			color: "#FFFFFF",
		},
		detail: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: "rgba(255,255,255,0.65)",
			marginTop: 2,
		},
		action: {
			paddingHorizontal: 10,
			paddingVertical: 6,
			borderRadius: RADIUS.sm,
			backgroundColor: "rgba(255,255,255,0.1)",
		},
		actionText: {
			fontFamily: "sans-bold",
			fontSize: 13,
			color: theme.accent,
		},
	});
