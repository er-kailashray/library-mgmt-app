import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiPost } from "@/services/api/client";
import { CreateAdmissionRequest } from "../types/admission.types";

export async function createAdmissionApi(payload: CreateAdmissionRequest): Promise<void> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    await apiPost("/api/admission", payload, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}
