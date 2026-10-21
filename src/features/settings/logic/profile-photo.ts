import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

import { AuthUser } from "@/features/auth/types/auth.types";
import { updateStoredAuthUser, uploadProfilePhotoApi } from "@/services/api/auth.api";

type PhotoSource = "camera" | "gallery";

function askPhotoSource(): Promise<PhotoSource | null> {
	return new Promise((resolve) => {
		Alert.alert(
			"Profile photo",
			"Choose where to get your photo from",
			[
				{ text: "Take Photo", onPress: () => resolve("camera") },
				{ text: "Choose from Gallery", onPress: () => resolve("gallery") },
				{ text: "Cancel", style: "cancel", onPress: () => resolve(null) },
			],
			{ cancelable: true, onDismiss: () => resolve(null) }
		);
	});
}

/**
 * Asks camera vs gallery and lets the owner pick a square-cropped photo.
 * Resolves to the local image URI, or null if the owner backed out.
 */
export async function pickProfilePhoto(): Promise<string | null> {
	const source = await askPhotoSource();
	if (!source) return null;

	// The gallery goes through the system photo picker, which needs no permission - asking for
	// media-library access first only added a slow extra round-trip before the picker opened.
	if (source === "camera") {
		const permission = await ImagePicker.requestCameraPermissionsAsync();
		if (!permission.granted) {
			Alert.alert("Permission needed", "Please allow camera access to take a photo.");
			return null;
		}
	}

	const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 };
	const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
	if (result.canceled || !result.assets[0]) return null;

	return result.assets[0].uri;
}

/** Uploads the picked photo and stores the updated user locally. Errors are thrown to the caller. */
export async function uploadProfilePhoto(uri: string): Promise<AuthUser> {
	const response = await uploadProfilePhotoApi(uri);
	await updateStoredAuthUser(response.user);
	return response.user;
}
