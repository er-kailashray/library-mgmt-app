import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Keyboard, Platform, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance, type TextInputInstance } from "react-native";

/** Room left between a field's bottom edge and the top of the keyboard. */
const MARGIN = 24;

/**
 * Keeps the field being typed in clear of the keyboard, inside a ScrollView, on both platforms.
 *
 * Once the keyboard is up it measures where the focused field sits on screen, compares that with
 * the keyboard's top edge, and scrolls by exactly the overlap (plus a margin). That works whether
 * or not Android resized the window for the keyboard, which a fixed "scroll to this section" can't
 * know. `bottomInset` is extra padding for the scroll content while the keyboard is up, so even the
 * last field on the page has room to scroll above it.
 *
 * Wire up: `onScroll` (with scrollEventThrottle) on the ScrollView, `bottomInset` into its
 * contentContainer paddingBottom, and `onFocus={() => reveal(ref)}` on each TextInput.
 */
export function useKeyboardReveal(scrollRef: RefObject<ScrollViewInstance | null>) {
	const scrollY = useRef(0);
	const keyboardTop = useRef<number | null>(null);
	const focused = useRef<TextInputInstance | null>(null);
	const [keyboardHeight, setKeyboardHeight] = useState(0);

	const revealFocused = useCallback(() => {
		const input = focused.current;
		const top = keyboardTop.current;
		if (!input || top == null) return;
		input.measureInWindow((_x, y, _width, height) => {
			const overlap = y + height + MARGIN - top;
			if (overlap > 0) scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
		});
	}, [scrollRef]);

	useEffect(() => {
		const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
		const show = Keyboard.addListener(showEvent, (e) => {
			keyboardTop.current = e.endCoordinates.screenY;
			setKeyboardHeight(e.endCoordinates.height);
			// Let the screen settle (iOS's keyboard avoidance, Android's resize) before measuring.
			setTimeout(revealFocused, Platform.OS === "ios" ? 300 : 80);
		});
		const hide = Keyboard.addListener(hideEvent, () => {
			keyboardTop.current = null;
			setKeyboardHeight(0);
		});
		return () => {
			show.remove();
			hide.remove();
		};
	}, [revealFocused]);

	/** Call from a TextInput's onFocus with its ref. */
	const reveal = useCallback(
		(input: RefObject<TextInputInstance | null>) => {
			focused.current = input.current;
			// Moving between fields with the keyboard already up: no show event will come.
			if (keyboardTop.current != null) setTimeout(revealFocused, 50);
		},
		[revealFocused]
	);

	const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
		scrollY.current = e.nativeEvent.contentOffset.y;
	}, []);

	// iOS's KeyboardAvoidingView already shrinks the screen; Android may not, so give it the room.
	const bottomInset = Platform.OS === "android" ? keyboardHeight : 0;

	return { reveal, onScroll, bottomInset };
}
