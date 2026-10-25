import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiFetch, apiPost } from "@/services/api/client";
import { NotificationsResponse, UnreadCountResponse } from "../types/notifications.types";

async function authHeaders() {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");
    return { Authorization: `Bearer ${token}` };
}

/** Newest first, 30 at a time; pass the last id shown as `before` for the next page. */
export async function getNotificationsApi(before?: number): Promise<NotificationsResponse> {
    return apiFetch<NotificationsResponse>(`/api/notifications${before ? `?before=${before}` : ""}`, {
        headers: await authHeaders(),
    });
}

export async function getUnreadCountApi(): Promise<UnreadCountResponse> {
    return apiFetch<UnreadCountResponse>("/api/notifications/unread-count", {
        headers: await authHeaders(),
    });
}

/** Marks the given alerts read, or every one of them when `ids` is left out. */
export async function markNotificationsReadApi(ids?: number[]): Promise<UnreadCountResponse> {
    return apiPost<UnreadCountResponse>("/api/notifications/read", ids ? { ids } : {}, {
        headers: await authHeaders(),
    });
}
