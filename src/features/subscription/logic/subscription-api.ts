import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiFetch, apiPost } from "@/services/api/client";
import { CheckoutResponse, SubscriptionInfo, SubscriptionInvoicesResponse, SubscriptionResponse, SubscriptionStateKey } from "../types/subscription.types";

export async function getSubscriptionApi(): Promise<SubscriptionResponse> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiFetch<SubscriptionResponse>("/api/subscription", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

/** Creates a Razorpay order; returns the signed checkout page to open, which comes back to `returnUrl`. */
export async function startCheckoutApi(plan: string, returnUrl: string): Promise<CheckoutResponse> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiPost<CheckoutResponse>("/api/subscription/checkout", { plan, return_url: returnUrl }, { headers: { Authorization: `Bearer ${token}` } });
}

export async function getSubscriptionInvoicesApi(): Promise<SubscriptionInvoicesResponse> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiFetch<SubscriptionInvoicesResponse>("/api/subscription/payments", { headers: { Authorization: `Bearer ${token}` } });
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
