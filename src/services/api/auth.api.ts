import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { AuthUser } from "@/features/auth/types/auth.types";
import { STORAGE_KEYS } from "@/shared/constants/storage";
import { uploadImage } from "@/shared/utils/image-upload";
import { apiFetch, apiPost, apiUrl } from "./client";

export interface LoginRequest {
	phone: string;
	password: string;
}

export interface LoginResponse {
	user: AuthUser;
	token: string;
}

export async function loginApi(payload: LoginRequest): Promise<LoginResponse> {
	return apiPost<LoginResponse>("/api/login", payload);
}

export async function getMeApi(): Promise<AuthUser> {
	const token = await getStoredAuthToken();
	if (!token) throw new Error("No auth token");

	return apiPost<AuthUser>("/api/me", {}, { headers: { Authorization: `Bearer ${token}` } });
}

export async function updateProfileApi(payload: { name: string; phone: string }): Promise<{ message: string; user: AuthUser }> {
	const token = await getStoredAuthToken();
	if (!token) throw new Error("No auth token");

	return apiPost<{ message: string; user: AuthUser }>("/api/me/update", payload, {
		headers: { Authorization: `Bearer ${token}` },
	});
}

/** Step 1 of changing the sign-in number: the current password, then a code is texted to the new number. */
export async function requestPhoneChangeApi(phone: string, currentPassword: string): Promise<{ message: string; retry_after?: number }> {
	const token = await getStoredAuthToken();
	if (!token) throw new Error("No auth token");

	return apiPost("/api/me/phone/request", { phone, current_password: currentPassword }, { headers: { Authorization: `Bearer ${token}` } });
}

/** Step 2: the code from the new number switches the account to it. */
export async function verifyPhoneChangeApi(phone: string, otp: string): Promise<{ message: string; user: AuthUser }> {
	const token = await getStoredAuthToken();
	if (!token) throw new Error("No auth token");

	return apiPost("/api/me/phone/verify", { phone, otp }, { headers: { Authorization: `Bearer ${token}` } });
}

/** Other devices are signed out; this one keeps its token. */
export async function changePasswordApi(currentPassword: string, newPassword: string): Promise<{ message: string }> {
	const token = await getStoredAuthToken();
	if (!token) throw new Error("No auth token");

	return apiPost<{ message: string }>(
		"/api/me/password",
		{ current_password: currentPassword, password: newPassword, password_confirmation: newPassword },
		{ headers: { Authorization: `Bearer ${token}` } },
	);
}

export async function uploadProfilePhotoApi(uri: string): Promise<{ message: string; user: AuthUser }> {
	const token = await getStoredAuthToken();
	if (!token) throw new Error("No auth token");

	const result = await uploadImage(apiUrl("/api/me/photo"), uri, {
		fieldName: "photo",
		headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
	});

	const body = result.body ? JSON.parse(result.body) : null;
	if (result.status < 200 || result.status >= 300) {
		throw new Error(body?.message ?? "Failed to upload photo.");
	}
	return body;
}

export async function logoutApi(): Promise<void> {
	await apiFetch("/api/logout", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${await getStoredAuthToken()}`,
		},
	});
}

/*
 * The sign-in token lives in the phone's encrypted store (iOS Keychain / Android Keystore via
 * expo-secure-store), not AsyncStorage, which is plain files another app or a backup could read.
 * Web has no secure store, and a development build made before expo-secure-store was added lacks
 * the native module (rebuild to get it); both fall back to AsyncStorage. The non-secret user
 * profile stays in AsyncStorage.
 */
const SECURE_TOKEN_KEY = "librum.auth_token";
let cachedToken: string | null | undefined;

async function secureStore(): Promise<typeof import("expo-secure-store") | null> {
	if (Platform.OS === "web") return null;
	try {
		const store = await import("expo-secure-store");
		return (await store.isAvailableAsync()) ? store : null;
	} catch {
		return null;
	}
}

async function writeToken(token: string | null): Promise<void> {
	cachedToken = token;
	const store = await secureStore();
	if (store) {
		if (token) await store.setItemAsync(SECURE_TOKEN_KEY, token);
		else await store.deleteItemAsync(SECURE_TOKEN_KEY);
		// Never leave a copy in plain storage.
		await AsyncStorage.removeItem(STORAGE_KEYS.authToken);
		return;
	}
	if (token) await AsyncStorage.setItem(STORAGE_KEYS.authToken, token);
	else await AsyncStorage.removeItem(STORAGE_KEYS.authToken);
}

export async function saveAuthData(token: string, user: AuthUser): Promise<void> {
	await writeToken(token);
	await AsyncStorage.setItem(STORAGE_KEYS.authUser, JSON.stringify(user));
}

export async function updateStoredAuthUser(user: AuthUser): Promise<void> {
	await AsyncStorage.setItem(STORAGE_KEYS.authUser, JSON.stringify(user));
}

export async function clearAuthData(): Promise<void> {
	await writeToken(null);
	await AsyncStorage.removeItem(STORAGE_KEYS.authUser);
}

export async function getStoredAuthToken(): Promise<string | null> {
	if (cachedToken !== undefined) return cachedToken;
	const store = await secureStore();
	if (!store) {
		cachedToken = await AsyncStorage.getItem(STORAGE_KEYS.authToken);
		return cachedToken;
	}
	const token = await store.getItemAsync(SECURE_TOKEN_KEY);
	if (token) {
		cachedToken = token;
		return token;
	}
	// Signed in with an older version: move the token into the secure store once.
	const legacy = await AsyncStorage.getItem(STORAGE_KEYS.authToken);
	if (legacy) await writeToken(legacy);
	else cachedToken = null;
	return legacy;
}

export async function getStoredAuthUser(): Promise<AuthUser | null> {
	const json = await AsyncStorage.getItem(STORAGE_KEYS.authUser);
	return json ? (JSON.parse(json) as AuthUser) : null;
}
