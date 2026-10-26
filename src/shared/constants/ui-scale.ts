import { Dimensions, PixelRatio, StyleSheet } from "react-native";

/**
 * The app was designed on a 402-point-wide iPhone. A narrower phone (a 360-wide Android, say) has
 * the same point sizes on less screen, so the same layout looks big and crowded there. On those
 * phones sizes shrink a little; at the design width and wider they're left exactly as written.
 *
 * The shrink is gentler than the width ratio (70% of it): fully proportional scaling would take
 * 12-point captions under 11 on a 360 phone, which is hard to read.
 */
const DESIGN_WIDTH = 402;
/** Never shrink below this share of the design width, whatever the phone. */
const MIN_RATIO = 0.82;
/** How much of the width difference text follows (0 = none, 1 = fully proportional). */
const TEXT_FOLLOW = 0.7;
/** Same for fixed layout sizes: avatars, icon tiles, the hero number's box. */
const SIZE_FOLLOW = 0.7;
/** Same for spacing: padding, margins and gaps inside and between cards. */
const SPACE_FOLLOW = 0.7;

// Portrait-only app, so the width at launch is the width for good.
const { width } = Dimensions.get("window");
const ratio = Math.min(1, Math.max(MIN_RATIO, width / DESIGN_WIDTH));

/** Multiplier for font sizes (1 on the design width and wider; about 0.93 on a 360-wide phone). */
export const TEXT_SCALE = 1 - (1 - ratio) * TEXT_FOLLOW;
/** Multiplier for fixed layout sizes (about 0.93 on a 360-wide phone). */
export const SIZE_SCALE = 1 - (1 - ratio) * SIZE_FOLLOW;
/** Multiplier for padding, margins and gaps (about 0.93 on a 360-wide phone). */
export const SPACE_SCALE = 1 - (1 - ratio) * SPACE_FOLLOW;

/** A font size (or line height) for this phone, on whole device pixels. */
export function scaleFont(size: number): number {
	return TEXT_SCALE === 1 ? size : PixelRatio.roundToNearestPixel(size * TEXT_SCALE);
}

/**
 * A fixed layout size for this phone: avatars, icon tiles, big numbers' boxes. Spacing between
 * things doesn't need it; use it where a large fixed block crowds a narrow screen.
 */
export function scale(size: number): number {
	return SIZE_SCALE === 1 ? size : PixelRatio.roundToNearestPixel(size * SIZE_SCALE);
}

/**
 * A padding/margin/gap for this phone. ScaledSheet applies this to every spacing value, so layout
 * math that adds up the same constants (a grid's tile width, a scroll offset) must use it too.
 */
export function space(size: number): number {
	return SPACE_SCALE === 1 ? size : PixelRatio.roundToNearestPixel(size * SPACE_SCALE);
}

const SPACING_KEYS = new Set([
	"padding",
	"paddingHorizontal",
	"paddingVertical",
	"paddingTop",
	"paddingBottom",
	"paddingLeft",
	"paddingRight",
	"paddingStart",
	"paddingEnd",
	"margin",
	"marginHorizontal",
	"marginVertical",
	"marginTop",
	"marginBottom",
	"marginLeft",
	"marginRight",
	"marginStart",
	"marginEnd",
	"gap",
	"rowGap",
	"columnGap",
]);

function scaleSpacing<S extends Record<string, any>>(styles: S): S {
	const out: Record<string, any> = {};
	for (const [name, style] of Object.entries(styles)) {
		const scaled: Record<string, any> = {};
		for (const [key, value] of Object.entries(style ?? {})) {
			scaled[key] = typeof value === "number" && SPACING_KEYS.has(key) ? space(value) : value;
		}
		out[name] = scaled;
	}
	return out as S;
}

/**
 * StyleSheet.create with every padding, margin and gap scaled by `space()`, so cards sit a little
 * tighter on narrow phones. Use it in place of StyleSheet.create for screen and component styles.
 * Sizes (width, height, radius), positions and fonts are left as written (fonts scale in Text).
 */
export const ScaledSheet: { create: typeof StyleSheet.create } = {
	create: (styles) => StyleSheet.create(SPACE_SCALE === 1 ? styles : scaleSpacing(styles)),
};
