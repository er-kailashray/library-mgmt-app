import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { FLOATING_SHADOW, RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useKeyboardLift } from "@/shared/hooks/useKeyboardLift";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";
import { ToastHost } from "@/shared/ui/Toast";

type Props = {
	visible: boolean;
	/** Called once the sheet has slid away (backdrop tap, swipe down, back button or close button). */
	onClose: () => void;
	/**
	 * Called after the sheet has fully gone, however it was closed (including the parent setting
	 * `visible` to false). For work that must wait until it's off screen, e.g. opening another sheet.
	 */
	onClosed?: () => void;
	title?: string;
	subtitle?: string;
	/** A close (x) button beside the title. */
	showClose?: boolean;
	/** Extra content at the right of the title row, before the close button. */
	headerRight?: ReactNode;
	children: ReactNode;
	/** Style for the sheet panel, e.g. a fixed height for a list. */
	style?: StyleProp<ViewStyle>;
	/** Bottom padding on top of the safe-area inset. */
	bottomPadding?: number;
	/** Drawn in a dark backdrop colour regardless of theme (photo viewers etc. use their own). */
	backdropOpacity?: number;
};

/** Off-screen distance the sheet starts from; real height isn't needed since it slides fully out. */
const OFFSCREEN = 900;
/** How far a drag (or how fast a flick) has to go to close the sheet rather than spring back. */
const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 900;

/**
 * The app's bottom sheet: the backdrop fades in while the panel springs up from the bottom; drag
 * the top of the panel down (or tap outside, or press back) to close. The panel rides on top of
 * the keyboard (measured, so it works on Android too) and clears the home indicator. `visible`
 * drives it: the sheet animates out before unmounting.
 */
export function BottomSheet(props: Props) {
	const { visible, onClose } = props;

	// Stays mounted until the slide-out finishes, so closing animates even when `visible` flips first.
	const [mounted, setMounted] = useState(visible);
	const translateY = useSharedValue(OFFSCREEN);
	const backdrop = useSharedValue(0);
	const closing = useRef(false);

	const onClosedRef = useRef(props.onClosed);
	onClosedRef.current = props.onClosed;
	const unmount = useCallback(() => {
		setMounted(false);
		onClosedRef.current?.();
	}, []);

	const animateIn = useCallback(() => {
		closing.current = false;
		translateY.value = OFFSCREEN;
		backdrop.value = 0;
		translateY.value = withSpring(0, { damping: 24, stiffness: 240, mass: 0.9 });
		backdrop.value = withTiming(1, { duration: 220 });
	}, [translateY, backdrop]);

	const animateOut = useCallback(
		(then: () => void) => {
			backdrop.value = withTiming(0, { duration: 200 });
			translateY.value = withTiming(OFFSCREEN, { duration: 240, easing: Easing.in(Easing.cubic) }, (finished) => {
				if (finished) runOnJS(then)();
			});
		},
		[translateY, backdrop]
	);

	useEffect(() => {
		if (visible) {
			setMounted(true);
			animateIn();
		} else if (mounted && !closing.current) {
			// The parent closed it (e.g. after saving): slide out, then unmount.
			closing.current = true;
			animateOut(unmount);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [visible]);

	// Closed from inside (backdrop, swipe, back button, x): slide out, then tell the parent.
	const requestClose = useCallback(() => {
		if (closing.current) return;
		closing.current = true;
		animateOut(() => {
			unmount();
			onClose();
		});
	}, [animateOut, onClose, unmount]);

	const drag = Gesture.Pan()
		.onUpdate((e) => {
			// Down follows the finger; up resists so the panel only stretches a little.
			translateY.value = e.translationY > 0 ? e.translationY : e.translationY / 6;
		})
		.onEnd((e) => {
			if (e.translationY > CLOSE_DISTANCE || e.velocityY > CLOSE_VELOCITY) {
				runOnJS(requestClose)();
			} else {
				translateY.value = withSpring(0, { damping: 24, stiffness: 260 });
			}
		});

	if (!mounted) return null;

	return (
		// Full-screen on Android too (under the status and navigation bars), so window and screen
		// coordinates match for the keyboard measurement. The Modal is its own native window, so it
		// needs its own gesture root and safe-area provider.
		<Modal visible transparent animationType="none" onRequestClose={requestClose} statusBarTranslucent navigationBarTranslucent>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<SafeAreaProvider>
					<SheetBody {...props} translateY={translateY} backdrop={backdrop} drag={drag} requestClose={requestClose} />
					{/* Toasts raised while the sheet is open show above it rather than behind. Gone as soon as
					    the sheet starts closing, so a "Saved" shown on close lands on the screen underneath. */}
					{visible && <ToastHost />}
				</SafeAreaProvider>
			</GestureHandlerRootView>
		</Modal>
	);
}

type SheetBodyProps = Props & {
	translateY: SharedValue<number>;
	backdrop: SharedValue<number>;
	drag: ReturnType<typeof Gesture.Pan>;
	requestClose: () => void;
};

function SheetBody({ title, subtitle, showClose, headerRight, children, style, bottomPadding = 20, backdropOpacity = 0.45, translateY, backdrop, drag, requestClose }: SheetBodyProps) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();
	const { rootRef, lift, rootHeight, keyboardOpen, onRootLayout } = useKeyboardLift(height);

	const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
	const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value * Math.max(0, 1 - translateY.value / OFFSCREEN) }));

	return (
		<View ref={rootRef} style={styles.root} onLayout={(e) => onRootLayout(e.nativeEvent.layout.height)}>
			<Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${backdropOpacity})` }, backdropStyle]}>
				<Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityRole="button" accessibilityLabel="Close" />
			</Animated.View>

			{/* With the keyboard up, the panel sits on it and fits in the space above. */}
			<Animated.View
				style={[
					styles.sheet,
					{
						marginBottom: lift,
						paddingBottom: keyboardOpen ? 16 : bottomPadding + insets.bottom,
						maxHeight: keyboardOpen ? rootHeight - lift - insets.top - 12 : rootHeight * 0.92,
					},
					style,
					sheetStyle,
				]}>
				{/* The handle and title are the drag area; the content below keeps its own scrolling. */}
				<GestureDetector gesture={drag}>
					<View style={styles.dragArea}>
						<View style={styles.handle} />
						{(title || showClose || headerRight) && (
							<View style={styles.header}>
								<View style={styles.headerText}>
									{title ? <Text style={styles.title}>{title}</Text> : null}
									{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
								</View>
								{headerRight}
								{showClose && (
									<Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.closeBtn} onPress={requestClose} hitSlop={8}>
										<Ionicons name="close" size={20} color={theme.primary} />
									</Pressable>
								)}
							</View>
						)}
					</View>
				</GestureDetector>
				{children}
			</Animated.View>
		</View>
	);
}

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		root: {
			flex: 1,
			justifyContent: "flex-end",
		},
		sheet: {
			backgroundColor: theme.background,
			borderTopLeftRadius: RADIUS.lg + 4,
			borderTopRightRadius: RADIUS.lg + 4,
			paddingHorizontal: 20,
			paddingTop: 10,
			...FLOATING_SHADOW,
		},
		dragArea: {
			paddingBottom: 4,
		},
		handle: {
			alignSelf: "center",
			width: 36,
			height: 4,
			borderRadius: 2,
			backgroundColor: theme.mutedForeground + "55",
			marginBottom: 14,
		},
		header: {
			flexDirection: "row",
			alignItems: "flex-start",
			gap: 12,
			marginBottom: 8,
		},
		headerText: {
			flex: 1,
		},
		title: {
			fontFamily: "sans-bold",
			fontSize: 20,
			color: theme.primary,
		},
		subtitle: {
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
			marginTop: 2,
		},
		closeBtn: {
			width: 32,
			height: 32,
			borderRadius: 16,
			backgroundColor: theme.muted,
			alignItems: "center",
			justifyContent: "center",
		},
	});
