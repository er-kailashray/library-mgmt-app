import type { ComponentProps } from "react";
import { Text as RNText, TextInput as RNTextInput, StyleSheet, type StyleProp, type TextStyle } from "react-native";

import { scaleFont, TEXT_SCALE } from "@/shared/constants/ui-scale";

/**
 * React Native's Text and TextInput, drawn at the size the styles say on every phone.
 *
 * By default React Native multiplies every font size by the phone's system text-size setting.
 * Many Android phones sit above 100% out of the box, so the same screen looked noticeably bigger
 * on Android than on iPhone, and the compact rows, badges and grids were designed for 100%.
 * Owners asked for Android to match iOS, so scaling is off here. A screen can still opt back in
 * with `allowFontScaling` (and `maxFontSizeMultiplier`) on a single element.
 *
 * On phones narrower than the design width, font sizes also shrink a little (see ui-scale.ts),
 * so a 360-wide Android doesn't look oversized next to the iPhone the screens were designed on.
 *
 * Import Text/TextInput from here, not from "react-native". (`Text.defaultProps` can't do this:
 * React 19 ignores defaultProps on function components, which Text and TextInput now are.)
 */
export function Text({ style, ...props }: ComponentProps<typeof RNText>) {
	return <RNText allowFontScaling={false} style={scaledStyle(style)} {...props} />;
}

export function TextInput({ style, ...props }: ComponentProps<typeof RNTextInput>) {
	return <RNTextInput allowFontScaling={false} style={scaledStyle(style)} {...props} />;
}

/** Text styles with fontSize, lineHeight and letterSpacing shrunk for a narrow phone. */
function scaledStyle(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
	if (TEXT_SCALE === 1 || !style) return style;
	const flat = StyleSheet.flatten(style);
	if (!flat || (flat.fontSize === undefined && flat.lineHeight === undefined)) return style;
	return {
		...flat,
		...(flat.fontSize !== undefined && { fontSize: scaleFont(flat.fontSize) }),
		...(flat.lineHeight !== undefined && { lineHeight: scaleFont(flat.lineHeight) }),
		...(flat.letterSpacing !== undefined && { letterSpacing: flat.letterSpacing * TEXT_SCALE }),
	};
}
