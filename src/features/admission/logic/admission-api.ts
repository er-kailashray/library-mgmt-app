import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiPost } from "@/services/api/client";
import { CreateAdmissionRequest, CreateAdmissionResult } from "../types/admission.types";

export async function createAdmissionApi(payload: CreateAdmissionRequest): Promise<CreateAdmissionResult> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    const response = await apiPost<{ data: { id: number } }>(
        "/api/admission",
        {
            name: payload.name,
            phone: payload.phone,
            gender: payload.gender,
            allocations: payload.allocations,
            payment: payload.payment,
            previous_dues_paid: payload.previous_dues_paid,
            previous_dues_mode: payload.previous_dues_mode,
        },
        { headers: { Authorization: `Bearer ${token}` } }
    );

    return { memberId: response.data.id };
}
