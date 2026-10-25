import { useSyncExternalStore } from "react";

import { getUnreadCountApi } from "./notifications-api";

/**
 * The Alerts tab badge. One shared value so the tab bar and the Alerts screen agree: the screen
 * sets it after marking things read, and the tab bar refreshes it when a push arrives or the
 * app comes back to the foreground.
 */
let unreadCount = 0;
const listeners = new Set<() => void>();

export function setUnreadCount(count: number) {
    if (count === unreadCount) return;
    unreadCount = count;
    listeners.forEach((listener) => listener());
}

export async function refreshUnreadCount(): Promise<void> {
    try {
        const response = await getUnreadCountApi();
        if (response.status) setUnreadCount(response.data.unread_count);
    } catch {
        // Signed out or offline: keep the last known count rather than flashing it away.
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useUnreadCount(): number {
    return useSyncExternalStore(subscribe, () => unreadCount);
}
