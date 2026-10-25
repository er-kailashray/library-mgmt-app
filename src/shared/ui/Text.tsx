import type { ComponentProps } from "react";
import { Text as RNText, TextInput as RNTextInput } from "react-native";

/**
 * React Native's Text and TextInput, drawn at the size the styles say on every phone.
 *
 * By default React Native multiplies every font size by the phone's system text-size setting.
 * Many Android phones sit above 100% out of the box, so the same screen looked noticeably bigger
 * on Android than on iPhone, and the compact rows, badges and grids were designed for 100%.
 * Owners asked for Android to match iOS, so scaling is off here. A screen can still opt back in
 * with `allowFontScaling` (and `maxFontSizeMultiplier`) on a single element.
 *
 * Import Text/TextInput from here, not from "react-native". (`Text.defaultProps` can't do this:
 * React 19 ignores defaultProps on function components, which Text and TextInput now are.)
 */
export function Text(props: ComponentProps<typeof RNText>) {
	return <RNText allowFontScaling={false} {...props} />;
}

export function TextInput(props: ComponentProps<typeof RNTextInput>) {
	return <RNTextInput allowFontScaling={false} {...props} />;
}
