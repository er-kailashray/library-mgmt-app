import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { getLibraryProfileApi, updateLibraryLocationApi } from "@/features/library-profile/logic/library-profile-api";
import { RADIUS } from "@/shared/constants/layout";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ErrorState, LoadingState } from "@/shared/ui/AsyncState";

// Whole-of-India view, used when there's no saved pin and location permission is denied.
const INDIA_REGION: Region = { latitude: 22.9734, longitude: 78.6569, latitudeDelta: 20, longitudeDelta: 20 };
const STREET_DELTA = 0.005;
// ~5 m. Smaller "moves" come from the map re-laying out (e.g. keyboard opening), not the owner dragging.
const MIN_MOVE_DEGREES = 0.00005;

function toStreetRegion(latitude: number, longitude: number): Region {
	return { latitude, longitude, latitudeDelta: STREET_DELTA, longitudeDelta: STREET_DELTA };
}

function formatGeocodedAddress(place: Location.LocationGeocodedAddress): string {
	if (place.formattedAddress) return place.formattedAddress;
	const parts = [place.name, place.street, place.district, place.city, place.region, place.postalCode];
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

	const getCurrentRegion = useCallback(async (): Promise<Region | null> => {
		const permission = await Location.requestForegroundPermissionsAsync();
		if (!permission.granted) return null;
		const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
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

	const handleRegionChangeComplete = useCallback(
		async (region: Region) => {
			// Ignore the zoomed-out India fallback until the owner actually zooms in somewhere.
			if (region.latitudeDelta > 1) return;

			const lastPin = pinRef.current;
			if (lastPin && Math.abs(lastPin.latitude - region.latitude) < MIN_MOVE_DEGREES && Math.abs(lastPin.longitude - region.longitude) < MIN_MOVE_DEGREES) {
				return;
			}

			pinRef.current = { latitude: region.latitude, longitude: region.longitude };
			setPin(pinRef.current);
			if (addressEdited) return;

			try {
				setIsGeocoding(true);
				const [place] = await Location.reverseGeocodeAsync({ latitude: region.latitude, longitude: region.longitude });
				if (place) setAddress(formatGeocodedAddress(place));
			} catch {
				// Reverse geocoding is best-effort; the owner can still type the address.
			} finally {
				setIsGeocoding(false);
			}
		},
		[addressEdited]
	);

	const handleUseCurrentLocation = useCallback(async () => {
		try {
			setIsLocating(true);
			const dot = userLocationRef.current;
			const region = dot ? toStreetRegion(dot.latitude, dot.longitude) : await getCurrentRegion();
			if (!region) {
				Alert.alert("Location permission needed", "Allow location access, or drag the map to your library.");
				return;
			}
			setAddressEdited(false);
			mapRef.current?.animateToRegion(region, 600);
		} catch (err: any) {
			Alert.alert("Error", err.message || "Could not get your current location.");
		} finally {
			setIsLocating(false);
		}
	}, [getCurrentRegion]);

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
					onRegionChangeComplete={handleRegionChangeComplete}
					showsUserLocation
					onUserLocationChange={(event) => {
						const coordinate = event.nativeEvent.coordinate;
						if (coordinate) userLocationRef.current = { latitude: coordinate.latitude, longitude: coordinate.longitude };
					}}
					showsMyLocationButton={false}
					toolbarEnabled={false}
				/>

				{/* The pin stays fixed in the centre; the owner drags the map underneath it. */}
				<View pointerEvents="none" style={styles.pinWrap}>
					<Ionicons name="location" size={44} color={theme.accent} />
				</View>

				<Pressable accessibilityRole="button" accessibilityLabel="Go back" style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
					<Ionicons name="arrow-back" size={22} color={theme.primary} />
				</Pressable>

				<Pressable accessibilityRole="button" style={styles.locateBtn} onPress={handleUseCurrentLocation} disabled={isLocating}>
					{isLocating ? <ActivityIndicator size="small" color={theme.accent} /> : <Ionicons name="locate" size={18} color={theme.accent} />}
					<Text style={styles.locateBtnText}>Use current location</Text>
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
		pinWrap: {
			position: "absolute",
			top: "50%",
			left: "50%",
			// Shift up by the icon's full height so the pin's tip, not its middle, marks the spot.
			marginLeft: -22,
			marginTop: -44,
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
			fontFamily: "sans-extrabold",
			fontSize: 15,
			color: "#fff",
		},
	});
