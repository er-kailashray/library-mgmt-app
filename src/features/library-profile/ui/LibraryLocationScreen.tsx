import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { getLibraryProfileApi, updateLibraryLocationApi } from "@/features/library-profile/logic/library-profile-api";
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from "@/features/library-profile/logic/map-style";
import { FLOATING_SHADOW, RADIUS } from "@/shared/constants/layout";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { Text, TextInput } from "@/shared/ui/Text";

// Whole-of-India view, used when there's no saved pin and location permission is denied.
const INDIA_REGION: Region = { latitude: 22.9734, longitude: 78.6569, latitudeDelta: 20, longitudeDelta: 20 };
// ~250 m across: close enough to read shop and street names around the library.
const STREET_DELTA = 0.0025;
// ~5 m. Smaller "moves" come from the map re-laying out (e.g. keyboard opening), not the owner dragging.
const MIN_MOVE_DEGREES = 0.00005;
// Drawn map pin: round head on a thin stem whose end marks the exact point.
const PIN_HEAD = 34;
const PIN_STEM = 16;
// A fresh GPS fix can hang indoors or with GPS off; give up after this and say so.
const LOCATE_TIMEOUT_MS = 12000;

function toStreetRegion(latitude: number, longitude: number): Region {
	return { latitude, longitude, latitudeDelta: STREET_DELTA, longitudeDelta: STREET_DELTA };
}

// Plus Codes like "7JWV+5H" are what Android's geocoder returns when it has no real place name.
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}\b/i;

function formatGeocodedAddress(place: Location.LocationGeocodedAddress): string {
	if (place.formattedAddress) return place.formattedAddress.replace(PLUS_CODE, "").replace(/^[,\s]+/, "");
	const name = place.name && !PLUS_CODE.test(place.name) ? place.name : null;
	const parts = [name, place.street, place.district, place.subregion, place.city, place.region, place.postalCode];
	// `name` often repeats the street on iOS, so drop consecutive duplicates.
	return parts.filter((part, i) => part && part !== parts[i - 1]).join(", ");
}

export function LibraryLocationScreen() {
	const router = useRouter();
	const { theme, isDark } = useTheme();
	const insets = useSafeAreaInsets();
	const mapRef = useRef<MapView>(null);

	const { data: profile, isLoading, error, refetch } = useApiData(getLibraryProfileApi, []);

	const [initialRegion, setInitialRegion] = useState<Region | null>(null);
	const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
	const pinRef = useRef<{ latitude: number; longitude: number } | null>(null);
	// Latest fix behind the map's blue dot. Preferred for "Use current location" so the pin lands
	// exactly on the dot rather than on a separately-requested (and possibly coarser) fix.
	const userLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
	const [address, setAddress] = useState("");
	// Once the owner types into the address box, stop overwriting it as the map moves.
	const [addressEdited, setAddressEdited] = useState(false);
	const [isGeocoding, setIsGeocoding] = useState(false);
	const [isLocating, setIsLocating] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	// Location permission refused: the map opens on all of India and the owner places the pin by hand.
	const [locationDenied, setLocationDenied] = useState(false);
	// Android can't show the permission prompt again once the owner picked "Don't ask again".
	const canAskAgainRef = useRef(true);
	// Android reports a region at 0,0 ("South Atlantic Ocean") before the map has laid out; ignore
	// every region until the map says it's ready.
	const mapReadyRef = useRef(false);
	// "Use current location" in progress: the loader stays up until the address for that spot is in.
	const locatingRef = useRef(false);

	const finishLocating = useCallback(() => {
		locatingRef.current = false;
		setIsLocating(false);
	}, []);

	const getCurrentRegion = useCallback(async (): Promise<Region | null> => {
		const permission = await Location.requestForegroundPermissionsAsync();
		canAskAgainRef.current = permission.canAskAgain;
		setLocationDenied(!permission.granted);
		if (!permission.granted) return null;
		const position = await Promise.race([
			Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error("Couldn't find your location. Make sure location (GPS) is on and try again.")), LOCATE_TIMEOUT_MS)
			),
		]);
		return toStreetRegion(position.coords.latitude, position.coords.longitude);
	}, []);

	// Decide where the map opens: the saved pin if there is one, otherwise the owner's current location.
	useEffect(() => {
		if (!profile || initialRegion) return;

		if (profile.latitude != null && profile.longitude != null) {
			setInitialRegion(toStreetRegion(profile.latitude, profile.longitude));
			pinRef.current = { latitude: profile.latitude, longitude: profile.longitude };
			setPin(pinRef.current);
			setAddress(profile.address ?? "");
			setAddressEdited(!!profile.address);
			return;
		}

		void (async () => {
			try {
				setInitialRegion((await getCurrentRegion()) ?? INDIA_REGION);
			} catch {
				setInitialRegion(INDIA_REGION);
			}
		})();
	}, [profile, initialRegion, getCurrentRegion]);

	// Each address lookup gets a number; a slower, older lookup never overwrites a newer one.
	const geocodeRequestRef = useRef(0);

	/**
	 * Puts the pin at a point and, unless the owner has typed their own address (or `force`),
	 * fills the address for it. Called directly - not via the map's move events, which don't
	 * fire when the map is already at that spot.
	 */
	const placePin = useCallback(
		async (latitude: number, longitude: number, force: boolean) => {
			pinRef.current = { latitude, longitude };
			setPin(pinRef.current);
			if (addressEdited && !force) return;

			const request = ++geocodeRequestRef.current;
			try {
				setIsGeocoding(true);
				const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
				if (place && request === geocodeRequestRef.current) setAddress(formatGeocodedAddress(place));
			} catch {
				// Reverse geocoding is best-effort; the owner can still type the address.
			} finally {
				if (request === geocodeRequestRef.current) setIsGeocoding(false);
			}
		},
		[addressEdited]
	);

	/** Whether the map is showing a real spot to pin (not the India overview or Android's 0,0 placeholder). */
	const isPinnable = (region: Region) =>
		region.latitudeDelta > 0 && region.latitudeDelta <= 1 && !(Math.abs(region.latitude) < 0.01 && Math.abs(region.longitude) < 0.01);

	const handleMapReady = useCallback(() => {
		mapReadyRef.current = true;
		// The map's first region report can arrive before it's ready and gets ignored, so pin the
		// opening spot here. A saved pin already has its address, so leave that alone.
		if (!pinRef.current && initialRegion && isPinnable(initialRegion)) {
			void placePin(initialRegion.latitude, initialRegion.longitude, false);
		}
	}, [initialRegion, placePin]);

	const handleRegionChangeComplete = useCallback(
		(region: Region) => {
			// While "Use current location" runs, it places the pin itself.
			if (!mapReadyRef.current || locatingRef.current || !isPinnable(region)) return;

			const lastPin = pinRef.current;
			if (lastPin && Math.abs(lastPin.latitude - region.latitude) < MIN_MOVE_DEGREES && Math.abs(lastPin.longitude - region.longitude) < MIN_MOVE_DEGREES) {
				return;
			}
			void placePin(region.latitude, region.longitude, false);
		},
		[placePin]
	);

	const handleUseCurrentLocation = useCallback(async () => {
		if (locatingRef.current) return;
		locatingRef.current = true;
		setIsLocating(true);
		try {
			// The blue dot is the map's own fix, so centring on it puts the pin's tip exactly on the dot.
			// Without one yet (dot still appearing), ask for a fresh high-accuracy fix instead.
			const dot = userLocationRef.current;
			const region = dot ? toStreetRegion(dot.latitude, dot.longitude) : await getCurrentRegion();
			if (!region) {
				Alert.alert(
					"Location access is off",
					"Allow location access to jump to where you are, or zoom and drag the map to your library.",
					canAskAgainRef.current
						? [{ text: "OK" }]
						: [
								{ text: "Not now", style: "cancel" },
								{ text: "Open Settings", onPress: () => void Linking.openSettings() },
							]
				);
				return;
			}
			setAddressEdited(false);
			mapRef.current?.animateToRegion(region, 600);
			// Always refresh the address here, even if the owner had typed one: the pin is moving.
			await placePin(region.latitude, region.longitude, true);
		} catch (err: any) {
			Alert.alert("Couldn't find your location", err.message || "Please try again.");
		} finally {
			finishLocating();
		}
	}, [getCurrentRegion, placePin, finishLocating]);

	const handleSave = useCallback(async () => {
		if (!pin) {
			Alert.alert("Pick a location", "Drag the map so the pin sits on your library.");
			return;
		}
		if (!address.trim()) {
			Alert.alert("Error", "Please enter your library's address.");
			return;
		}
		try {
			setIsSaving(true);
			await updateLibraryLocationApi({ address: address.trim(), latitude: pin.latitude, longitude: pin.longitude });
			router.back();
		} catch (err: any) {
			Alert.alert("Error", err.message || "Failed to save location.");
		} finally {
			setIsSaving(false);
		}
	}, [pin, address, router]);

	const styles = createStyles(theme);

	if (isLoading || error || !profile || !initialRegion) {
		return (
			<SafeAreaView style={styles.safe} edges={["top"]}>
				{error ? <ErrorState message={error} onRetry={refetch} /> : <LoadingState />}
			</SafeAreaView>
		);
	}

	return (
		<View style={styles.safe}>
			<StatusBar style={isDark ? "light" : "dark"} />
			<View style={styles.mapWrap}>
				<MapView
					ref={mapRef}
					style={StyleSheet.absoluteFill}
					provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
					initialRegion={initialRegion}
					customMapStyle={isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
					showsBuildings
					onMapReady={handleMapReady}
					onRegionChangeComplete={handleRegionChangeComplete}
					showsUserLocation
					onUserLocationChange={(event) => {
						const coordinate = event.nativeEvent.coordinate;
						if (coordinate) userLocationRef.current = { latitude: coordinate.latitude, longitude: coordinate.longitude };
					}}
					showsMyLocationButton={false}
					toolbarEnabled={false}
				/>

				{/* The pin stays fixed in the centre; the owner drags the map underneath it. Its stem ends
				    exactly on the map's centre point, marked by the small shadow dot. */}
				<View pointerEvents="none" style={styles.pinShadow} />
				<View pointerEvents="none" style={styles.pinWrap}>
					<View style={styles.pinHead}>
						<View style={styles.pinHeadDot} />
					</View>
					<View style={styles.pinStem} />
				</View>

				<Pressable accessibilityRole="button" accessibilityLabel="Go back" style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
					<Ionicons name="arrow-back" size={22} color={theme.primary} />
				</Pressable>

				{locationDenied && !pin && (
					<View style={[styles.deniedBanner, { top: insets.top + 64 }]}>
						<Ionicons name="navigate-circle-outline" size={20} color={theme.accent} />
						<Text style={styles.deniedText}>Location access is off. Zoom in and drag the map until the pin sits on your library.</Text>
					</View>
				)}

				{isLocating && (
					<View pointerEvents="none" style={styles.locatingOverlay}>
						<View style={styles.locatingPill}>
							<ActivityIndicator size="small" color="#fff" />
							<Text style={styles.locatingText}>Finding your location…</Text>
						</View>
					</View>
				)}

				<Pressable
					accessibilityRole="button"
					accessibilityState={{ busy: isLocating }}
					style={[styles.locateBtn, isLocating && styles.locateBtnBusy]}
					onPress={handleUseCurrentLocation}
					disabled={isLocating}>
					{isLocating ? <ActivityIndicator size="small" color={theme.accent} /> : <Ionicons name="locate" size={18} color={theme.accent} />}
					<Text style={styles.locateBtnText}>{isLocating ? "Finding you…" : "Use current location"}</Text>
				</Pressable>
			</View>

			<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
				<View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
					<Text style={styles.sheetTitle}>Library location</Text>
					<Text style={styles.sheetHint}>Move the map to place the pin on your library's entrance. Students will use this to find you.</Text>

					<View style={styles.inputLabelRow}>
						<Text style={styles.inputLabel}>Full Address</Text>
						{/* Fixed-size slot so the spinner appearing doesn't change the sheet's height. */}
						<View style={styles.spinnerSlot}>{isGeocoding && <ActivityIndicator size="small" color={theme.mutedForeground} />}</View>
					</View>
					<TextInput
						style={styles.inputField}
						value={address}
						onChangeText={(text) => {
							setAddress(text);
							setAddressEdited(true);
						}}
						placeholder="Shop no., floor, street, landmark"
						placeholderTextColor={theme.mutedForeground + "80"}
						multiline
					/>

					<Pressable style={[styles.saveBtn, isSaving && { opacity: 0.7 }]} onPress={handleSave} disabled={isSaving}>
						{isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save Location</Text>}
					</Pressable>
				</View>
			</KeyboardAvoidingView>
		</View>
	);
}

const createStyles = (theme: any) =>
	StyleSheet.create({
		safe: {
			flex: 1,
			backgroundColor: theme.background,
		},
		mapWrap: {
			flex: 1,
		},
		// Head (PIN_HEAD) + stem (PIN_STEM): shifted up by its full height so the stem's end is the centre.
		pinWrap: {
			position: "absolute",
			top: "50%",
			left: "50%",
			width: PIN_HEAD,
			height: PIN_HEAD + PIN_STEM,
			marginLeft: -PIN_HEAD / 2,
			marginTop: -(PIN_HEAD + PIN_STEM),
			alignItems: "center",
		},
		pinHead: {
			width: PIN_HEAD,
			height: PIN_HEAD,
			borderRadius: PIN_HEAD / 2,
			backgroundColor: theme.accent,
			borderWidth: 3,
			borderColor: "#fff",
			alignItems: "center",
			justifyContent: "center",
			...FLOATING_SHADOW,
		},
		pinHeadDot: {
			width: 10,
			height: 10,
			borderRadius: 5,
			backgroundColor: "#fff",
		},
		pinStem: {
			width: 3,
			height: PIN_STEM,
			marginTop: -1,
			borderBottomLeftRadius: 1.5,
			borderBottomRightRadius: 1.5,
			backgroundColor: theme.accent,
		},
		pinShadow: {
			position: "absolute",
			top: "50%",
			left: "50%",
			width: 10,
			height: 4,
			marginLeft: -5,
			marginTop: -2,
			borderRadius: 5,
			backgroundColor: "rgba(0,0,0,0.35)",
		},
		backBtn: {
			position: "absolute",
			left: 16,
			width: 44,
			height: 44,
			borderRadius: 22,
			backgroundColor: theme.card,
			alignItems: "center",
			justifyContent: "center",
			borderWidth: 1,
			borderColor: theme.border,
		},
		deniedBanner: {
			position: "absolute",
			left: 16,
			right: 16,
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
			backgroundColor: theme.card,
			borderWidth: 1,
			borderColor: theme.border,
			borderRadius: RADIUS.md,
			paddingHorizontal: 14,
			paddingVertical: 12,
		},
		deniedText: {
			flex: 1,
			fontFamily: "sans-semibold",
			fontSize: 13,
			lineHeight: 18,
			color: theme.primary,
		},
		locateBtn: {
			position: "absolute",
			bottom: 16,
			alignSelf: "center",
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
			backgroundColor: theme.card,
			borderWidth: 1,
			borderColor: theme.accent,
			borderRadius: RADIUS.lg,
			paddingHorizontal: 16,
			paddingVertical: 10,
		},
		locateBtnBusy: {
			opacity: 0.8,
		},
		// Dims the map and sits the message above the pin while "Use current location" runs.
		locatingOverlay: {
			...StyleSheet.absoluteFill,
			backgroundColor: "rgba(0,0,0,0.08)",
			alignItems: "center",
			justifyContent: "center",
			// Centred, then lifted by half this padding so the pill clears the pin head.
			paddingBottom: (PIN_HEAD + PIN_STEM) * 2 + 60,
		},
		locatingPill: {
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
			backgroundColor: theme.primarySurface,
			borderRadius: RADIUS.lg,
			paddingHorizontal: 16,
			paddingVertical: 10,
			...FLOATING_SHADOW,
		},
		locatingText: {
			fontFamily: "sans-bold",
			fontSize: 14,
			color: "#fff",
		},
		locateBtnText: {
			fontFamily: "sans-bold",
			fontSize: 14,
			color: theme.accent,
		},
		sheet: {
			backgroundColor: theme.background,
			borderTopLeftRadius: RADIUS.lg,
			borderTopRightRadius: RADIUS.lg,
			marginTop: -16,
			paddingHorizontal: 20,
			paddingTop: 20,
		},
		sheetTitle: {
			fontFamily: "sans-extrabold",
			fontSize: 18,
			color: theme.primary,
			marginBottom: 4,
		},
		sheetHint: {
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
			lineHeight: 18,
			marginBottom: 16,
		},
		inputLabelRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
			marginBottom: 8,
		},
		spinnerSlot: {
			width: 20,
			height: 20,
			alignItems: "center",
			justifyContent: "center",
		},
		inputLabel: {
			fontFamily: "sans-bold",
			fontSize: 13,
			color: theme.primary,
			textTransform: "uppercase",
			letterSpacing: 1,
		},
		inputField: {
			fontFamily: "sans-medium",
			backgroundColor: theme.card,
			borderWidth: 1,
			borderColor: theme.border,
			borderRadius: RADIUS.md,
			paddingHorizontal: 16,
			paddingVertical: 14,
			fontSize: 15,
			color: theme.primary,
			// Fixed height: if the box grew with the address, the map above would shrink, shift its
			// centre, trigger another geocode, and loop - which made the screen visibly shake.
			height: 76,
			textAlignVertical: "top",
		},
		saveBtn: {
			backgroundColor: theme.accent,
			borderRadius: RADIUS.md,
			paddingVertical: 16,
			alignItems: "center",
			marginTop: 16,
		},
		saveBtnText: {
			...BUTTON_TEXT,
			color: "#fff",
		},
	});
