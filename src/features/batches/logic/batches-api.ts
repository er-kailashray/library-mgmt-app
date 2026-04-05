import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiFetch, apiPost } from "@/services/api/client";
import { CreateBatchRequest, GetBatchesResponse } from "../types/batches.types";

export async function getBatchesApi(): Promise<GetBatchesResponse> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiFetch<GetBatchesResponse>("/api/batches", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function createBatchApi(payload: CreateBatchRequest): Promise<void> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    await apiPost("/api/batches", payload, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}
