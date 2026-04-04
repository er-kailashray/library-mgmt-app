import AsyncStorage from "@react-native-async-storage/async-storage";

import { AuthUser } from "@/features/auth/types/auth.types";
import { STORAGE_KEYS } from "@/shared/constants/storage";
import { apiFetch, apiPost } from "./client";

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
