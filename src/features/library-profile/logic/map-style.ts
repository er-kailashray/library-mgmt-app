import type { MapStyleElement } from "react-native-maps";

/**
 * Calm Google Maps styles in the app's warm neutrals (Android only; Apple Maps ignores them).
 * Shop, landmark and street names all stay visible - owners place the pin by recognising
 * what's next door - but their icons are toned down so the library pin still stands out.
 */
const QUIET_ICONS: MapStyleElement[] = [
	{ featureType: "poi", elementType: "labels.icon", stylers: [{ saturation: -60 }, { lightness: 10 }] },
	{ featureType: "transit", elementType: "labels.icon", stylers: [{ saturation: -100 }] },
];

export const LIGHT_MAP_STYLE: MapStyleElement[] = [
	{ elementType: "geometry", stylers: [{ color: "#F4F1EC" }] },
	{ elementType: "labels.text.fill", stylers: [{ color: "#78716C" }] },
	{ elementType: "labels.text.stroke", stylers: [{ color: "#FDFCF9" }] },
	{ featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#D6D3D1" }] },
	{ featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#EFEBE5" }] },
	{ featureType: "poi", elementType: "geometry", stylers: [{ color: "#ECE8E1" }] },
	{ featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#E3EBDD" }] },
	{ featureType: "road", elementType: "geometry", stylers: [{ color: "#FFFFFF" }] },
	{ featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#E7E5E4" }] },
	{ featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#F5E3DC" }] },
	{ featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#EBCFC4" }] },
	{ featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#57534E" }] },
	{ featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#E7E5E4" }] },
	{ featureType: "water", elementType: "geometry", stylers: [{ color: "#D5E6E8" }] },
	{ featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#8AA6AB" }] },
	...QUIET_ICONS,
];

export const DARK_MAP_STYLE: MapStyleElement[] = [
	{ elementType: "geometry", stylers: [{ color: "#1C1917" }] },
	{ elementType: "labels.text.fill", stylers: [{ color: "#A8A29E" }] },
	{ elementType: "labels.text.stroke", stylers: [{ color: "#0C0A09" }] },
	{ featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#44403C" }] },
	{ featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#211E1B" }] },
	{ featureType: "poi", elementType: "geometry", stylers: [{ color: "#24201D" }] },
	{ featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1F2620" }] },
	{ featureType: "road", elementType: "geometry", stylers: [{ color: "#2E2A27" }] },
	{ featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1C1917" }] },
	{ featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4A3129" }] },
	{ featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#D6D3D1" }] },
	{ featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#2E2A27" }] },
	{ featureType: "water", elementType: "geometry", stylers: [{ color: "#0F2326" }] },
	{ featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4B6B70" }] },
	...QUIET_ICONS,
];
