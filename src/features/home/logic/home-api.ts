import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiFetch } from "@/services/api/client";
import { DashboardResponse } from "../types/home.types";

export async function getDashboardApi(): Promise<DashboardResponse> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiFetch<DashboardResponse>("/api/dashboard", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}
