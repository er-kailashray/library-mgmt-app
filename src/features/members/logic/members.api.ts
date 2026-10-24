import { IdProofSide, IdProofType } from "@/features/admission/types/admission.types";
import { Gender, MemberDetailResponse, MembersResponse } from "@/features/members/types/members.types";
import { PaymentMode } from "@/features/payments/types/payments.types";
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

/** Removes one side of the member's ID proof, or the whole ID proof when no side is given. */
export async function deleteMemberIdProofApi(id: number | string, side?: IdProofSide): Promise<{ status: boolean; message?: string }> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiFetch(`/api/members/${id}/id-proof${side ? `/${side}` : ""}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
}

export async function deactivateMemberApi(
    id: number | string,
    refund?: { refund_amount: number; refund_mode: PaymentMode }
): Promise<{ status: boolean; message?: string }> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiPost(`/api/members/${id}/deactivate`, refund ?? {}, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

/** Back after a break, paying later: due from `startDate` ("YYYY-MM-DD"); the gap isn't charged. */
export async function restartMemberApi(id: number | string, startDate: string): Promise<{ status: boolean; message?: string }> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiPost(`/api/members/${id}/restart`, { start_date: startDate }, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function updateMemberApi(
    id: number | string,
    payload: { name: string; phone: string; gender?: Gender | null; address?: string | null }
): Promise<{ status: boolean; message?: string }> {
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
