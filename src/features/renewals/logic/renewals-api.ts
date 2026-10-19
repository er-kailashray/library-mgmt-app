import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiFetch, apiPost } from "@/services/api/client";
import { BulkRenewalReminderResult, UpcomingRenewalsResponse } from "../types/renewals.types";

export async function getUpcomingRenewalsApi(): Promise<UpcomingRenewalsResponse> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiFetch<UpcomingRenewalsResponse>("/api/renewals/upcoming", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function remindAllUpcomingRenewalsApi(): Promise<{ status: boolean; message?: string; data: BulkRenewalReminderResult }> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiPost("/api/renewals/upcoming/remind", undefined, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}
