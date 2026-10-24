import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiPost } from "@/services/api/client";
import { CreateAdmissionRequest, CreateAdmissionResult } from "../types/admission.types";

export async function createAdmissionApi(payload: CreateAdmissionRequest): Promise<CreateAdmissionResult> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    // Send the whole request: a hand-picked list here once silently dropped new fields
    // (address, joining date, "paid till").
    const response = await apiPost<{ data: { id: number } }>("/api/admission", payload, { headers: { Authorization: `Bearer ${token}` } });

    return { memberId: response.data.id };
}
