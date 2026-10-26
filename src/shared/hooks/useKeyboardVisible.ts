import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * True while the on-screen keyboard is up. For hiding a sticky footer that would otherwise ride up
 * on top of the keyboard and cover the field being typed in. (iOS reports the change as it starts,
 * Android only once it's done.)
 */
export function useKeyboardVisible(): boolean {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
		const show = Keyboard.addListener(showEvent, () => setVisible(true));
		const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
		return () => {
			show.remove();
			hide.remove();
		};
	}, []);

	return visible;
}
