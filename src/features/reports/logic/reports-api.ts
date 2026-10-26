import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiFetch } from "@/services/api/client";
import { ReportMonths, ReportResponse } from "../types/reports.types";

export async function getReportApi(months: ReportMonths): Promise<ReportResponse> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiFetch<ReportResponse>(`/api/reports?months=${months}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}
