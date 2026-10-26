import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiFetch, apiPost } from "@/services/api/client";
import { AttendanceRosterResponse, ClearAttendanceRequest, MarkAttendanceRequest } from "../types/attendance.types";

export async function getAttendanceRosterApi(date?: string): Promise<AttendanceRosterResponse> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    const query = date ? `?date=${date}` : "";
    return apiFetch<AttendanceRosterResponse>(`/api/attendance${query}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function markAttendanceApi(payload: MarkAttendanceRequest): Promise<{ status: boolean; message?: string }> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiPost(`/api/attendance`, payload, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

/** Undo a check-in or absent mark for one member, batch and day. */
export async function clearAttendanceApi(payload: ClearAttendanceRequest): Promise<{ status: boolean; message?: string }> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiPost(`/api/attendance/clear`, payload, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}
