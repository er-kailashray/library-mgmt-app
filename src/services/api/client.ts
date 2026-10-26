import { notifyIfSubscriptionExpired } from "./subscription-guard";

const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

function buildUrl(path: string) {
	return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** For callers that need the full URL directly, e.g. an authenticated <Image> source. */
export function apiUrl(path: string) {
	return buildUrl(path);
}

/** Thrown for non-OK responses; keeps the status and body so callers can branch on them. */
export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly data: any,
	) {
		super(message);
		this.name = "ApiError";
	}
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
	const text = await response.text();
	const json = text.length ? JSON.parse(text) : null;

	if (!response.ok) {
		notifyIfSubscriptionExpired(response.status, json);
		throw new ApiError(json?.message ?? response.statusText ?? "Request failed", response.status, json);
	}

	return json as T;
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(buildUrl(path), {
		...init,
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
			...(init?.headers || {}),
		},
	});

	return parseJsonResponse<T>(response);
}

export async function apiPost<T = unknown>(path: string, body: unknown, init?: RequestInit): Promise<T> {
	return apiFetch<T>(path, {
		method: "POST",
		body: JSON.stringify(body),
		...init,
	});
}
