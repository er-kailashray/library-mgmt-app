import { notifyIfSessionExpired } from "./session-guard";
import { notifyIfSubscriptionExpired } from "./subscription-guard";

const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

/** How long a request may take before it's abandoned with a "took too long" error. */
const DEFAULT_TIMEOUT_MS = 20_000;

/** Messages shown when there's no usable reply from the server; screens display err.message as-is. */
export const NETWORK_ERROR_MESSAGE = "Couldn't reach the server. Check your internet connection and try again.";
export const TIMEOUT_ERROR_MESSAGE = "The server took too long to respond. Please try again.";
export const SERVER_ERROR_MESSAGE = "Something went wrong on our side. Please try again in a moment.";
export const SESSION_EXPIRED_MESSAGE = "Your session has ended. Please sign in again.";

function buildUrl(path: string) {
	return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** For callers that need the full URL directly, e.g. an authenticated <Image> source. */
export function apiUrl(path: string) {
	return buildUrl(path);
}

/**
 * Thrown for anything but a successful reply; keeps the status and body so callers can branch on
 * them. Status 0 means no reply at all (offline, or timed out).
 */
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

export type ApiInit = RequestInit & {
	/** Overrides DEFAULT_TIMEOUT_MS, e.g. for a slow report. */
	timeoutMs?: number;
};

function hasBearerToken(headers: HeadersInit | undefined): boolean {
	if (!headers) return false;
	if (headers instanceof Headers) return headers.has("Authorization");
	if (Array.isArray(headers)) return headers.some(([key]) => key.toLowerCase() === "authorization");
	return Object.keys(headers).some((key) => key.toLowerCase() === "authorization");
}

async function parseJsonResponse<T>(response: Response, hadToken: boolean): Promise<T> {
	const text = await response.text();
	// An HTML error page (a proxy, or a server crash) isn't JSON; don't surface "JSON Parse error".
	let json: any = null;
	try {
		json = text.length ? JSON.parse(text) : null;
	} catch {
		if (response.ok) throw new ApiError(SERVER_ERROR_MESSAGE, response.status, null);
	}

	if (!response.ok) {
		notifyIfSubscriptionExpired(response.status, json);
		if (notifyIfSessionExpired(response.status, hadToken)) {
			throw new ApiError(SESSION_EXPIRED_MESSAGE, response.status, json);
		}
		const fallback = response.status >= 500 ? SERVER_ERROR_MESSAGE : response.statusText || "Request failed";
		throw new ApiError(json?.message ?? fallback, response.status, json);
	}

	return json as T;
}

export async function apiFetch<T = unknown>(path: string, init?: ApiInit): Promise<T> {
	const { timeoutMs = DEFAULT_TIMEOUT_MS, ...requestInit } = init ?? {};
	const controller = new AbortController();
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, timeoutMs);
	// A caller's own abort signal still cancels the request.
	requestInit.signal?.addEventListener("abort", () => controller.abort());

	let response: Response;
	try {
		response = await fetch(buildUrl(path), {
			...requestInit,
			signal: controller.signal,
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				...(requestInit.headers || {}),
			},
		});
	} catch (err) {
		// fetch only rejects when there's no reply: offline, DNS, server unreachable, or aborted.
		if (requestInit.signal?.aborted) throw err;
		throw new ApiError(timedOut ? TIMEOUT_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE, 0, null);
	} finally {
		clearTimeout(timer);
	}

	return parseJsonResponse<T>(response, hasBearerToken(requestInit.headers));
}

export async function apiPost<T = unknown>(path: string, body: unknown, init?: ApiInit): Promise<T> {
	return apiFetch<T>(path, {
		method: "POST",
		body: JSON.stringify(body),
		...init,
	});
}
