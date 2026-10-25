import AsyncStorage from "@react-native-async-storage/async-storage";

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

export async function saveAuthData(token: string, user: AuthUser): Promise<void> {
	await AsyncStorage.multiSet([
		[STORAGE_KEYS.authToken, token],
		[STORAGE_KEYS.authUser, JSON.stringify(user)],
	]);
}

export async function updateStoredAuthUser(user: AuthUser): Promise<void> {
	await AsyncStorage.setItem(STORAGE_KEYS.authUser, JSON.stringify(user));
}

export async function clearAuthData(): Promise<void> {
	await AsyncStorage.multiRemove([STORAGE_KEYS.authToken, STORAGE_KEYS.authUser]);
}

export async function getStoredAuthToken(): Promise<string | null> {
	return AsyncStorage.getItem(STORAGE_KEYS.authToken);
}

export async function getStoredAuthUser(): Promise<AuthUser | null> {
	const json = await AsyncStorage.getItem(STORAGE_KEYS.authUser);
	return json ? (JSON.parse(json) as AuthUser) : null;
}
