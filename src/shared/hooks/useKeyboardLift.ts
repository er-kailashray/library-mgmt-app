import { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, View } from "react-native";

/**
 * For bottom sheets in a Modal, which the keyboard would otherwise cover (Android especially).
 * Android may or may not shrink the modal's window for the keyboard depending on the device and
 * edge-to-edge, so rather than assume, this measures how far the keyboard's top edge overlaps the
 * bottom of the full-screen root and returns exactly that as `lift`.
 *
 * Put `rootRef` and `onRootLayout` on a full-screen View inside the Modal (with
 * statusBarTranslucent / navigationBarTranslucent so window and screen coordinates match), raise
 * the sheet by `lift`, and cap its height with `rootHeight - lift`.
 */
export function useKeyboardLift(initialHeight: number) {
	const rootRef = useRef<View>(null);
	const [lift, setLift] = useState(0);
	const [rootHeight, setRootHeight] = useState(initialHeight);

	useEffect(() => {
		const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
		const show = Keyboard.addListener(showEvent, (e) => {
			const keyboardTop = e.endCoordinates.screenY;
			rootRef.current?.measureInWindow((_x, y, _w, h) => {
				setRootHeight(h);
				setLift(Math.max(0, y + h - keyboardTop));
			});
		});
		const hide = Keyboard.addListener(hideEvent, () => setLift(0));
		return () => {
			show.remove();
			hide.remove();
		};
	}, []);

	return {
		rootRef,
		lift,
		rootHeight,
		keyboardOpen: lift > 0,
		onRootLayout: (height: number) => setRootHeight(height),
	};
}
