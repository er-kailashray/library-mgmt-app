import { IdProofSide, IdProofType } from "@/features/admission/types/admission.types";
import { MemberDetailResponse, MembersResponse } from "@/features/members/types/members.types";
import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiFetch, apiPost, apiUrl } from "@/services/api/client";
import { uploadImage } from "@/shared/utils/image-upload";

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

/**
 * Builds the authenticated ID-proof image URL + headers, for an <Image source={...}> that
 * needs the Bearer token — the endpoint streams the stored file directly, not JSON.
 */
export async function getMemberIdProofSource(id: number | string, side: IdProofSide): Promise<{ uri: string; headers: Record<string, string> }> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return {
        uri: apiUrl(`/api/members/${id}/id-proof/${side}`),
        headers: { Authorization: `Bearer ${token}` },
    };
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

export async function updateMemberApi(id: number | string, payload: { name: string; phone: string }): Promise<{ status: boolean; message?: string }> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiPost(`/api/members/${id}/update`, payload, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function uploadMemberIdProofApi(
    id: number | string,
    idProofType: IdProofType,
    side: IdProofSide,
    uri: string
): Promise<{ status: boolean; message?: string }> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    const result = await uploadImage(apiUrl(`/api/members/${id}/id-proof`), uri, {
        fieldName: "id_proof",
        parameters: { id_proof_type: idProofType, side },
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });

    const body = result.body ? JSON.parse(result.body) : null;
    if (result.status < 200 || result.status >= 300) {
        throw new Error(body?.message ?? "Failed to upload ID proof.");
    }
    return body;
}
