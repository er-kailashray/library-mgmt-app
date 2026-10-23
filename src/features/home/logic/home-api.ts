import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiFetch } from "@/services/api/client";
import { DashboardResponse, MonthlyCollectionResponse } from "../types/home.types";

export async function getDashboardApi(): Promise<DashboardResponse> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiFetch<DashboardResponse>("/api/dashboard", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

/** Total collected in a past calendar month ("YYYY-MM"). */
export async function getMonthlyCollectionApi(month: string): Promise<MonthlyCollectionResponse> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiFetch<MonthlyCollectionResponse>(`/api/collections?month=${month}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}
