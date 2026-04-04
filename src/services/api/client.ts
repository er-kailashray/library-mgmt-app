const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

function buildUrl(path: string) {
	return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
	const text = await response.text();
	const json = text.length ? JSON.parse(text) : null;

	if (!response.ok) {
		throw new Error(json?.message ?? response.statusText ?? "Request failed");
	}

	return json as T;
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(buildUrl(path), {
		headers: {
			"Content-Type": "application/json",
		},
		...init,
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
