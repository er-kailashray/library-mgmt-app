import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiFetch } from "@/services/api/client";
import { SubscriptionInfo, SubscriptionResponse, SubscriptionStateKey } from "../types/subscription.types";

export async function getSubscriptionApi(): Promise<SubscriptionResponse> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiFetch<SubscriptionResponse>("/api/subscription", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export function formatSubscriptionDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Short label for chips, e.g. "Trial · 12 days left", "Yearly", "Expired". */
export function subscriptionChipLabel(info: SubscriptionInfo): string {
    const days = `${info.days_left} day${info.days_left === 1 ? "" : "s"}`;
    const labels: Record<SubscriptionStateKey, string> = {
        trial: `Trial · ${days} left`,
        active: info.plan?.name ?? "Active",
        grace: `Ends in ${days}`,
        expired: "Expired",
    };
    return labels[info.state];
}
