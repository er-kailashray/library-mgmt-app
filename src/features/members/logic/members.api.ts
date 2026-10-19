import { MemberDetailResponse, MembersResponse } from "@/features/members/types/members.types";
import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiFetch, apiPost } from "@/services/api/client";

export async function getMembersApi(): Promise<MembersResponse> {
    const token = await getStoredAuthToken();
    return apiFetch<MembersResponse>("/api/members", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function getMemberDetailApi(id: number | string): Promise<MemberDetailResponse> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiFetch<MemberDetailResponse>(`/api/members/${id}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function deactivateMemberApi(id: number | string): Promise<{ status: boolean; message?: string }> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiPost(`/api/members/${id}/deactivate`, undefined, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}
