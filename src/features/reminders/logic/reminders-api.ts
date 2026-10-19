import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiPost } from "@/services/api/client";

export async function remindMemberApi(memberId: number | string): Promise<{ status: boolean; message?: string }> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiPost(`/api/members/${memberId}/remind`, undefined, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export interface BulkReminderResult {
    sent: number;
    failed: number;
    failed_members: string[];
}

export async function remindAllOverdueApi(): Promise<{ status: boolean; message?: string; data: BulkReminderResult }> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiPost("/api/reminders/overdue", undefined, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}
