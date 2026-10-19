import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiFetch, apiPost } from "@/services/api/client";
import { CreatePaymentRequest, CreatePaymentResponse, PaymentsResponse } from "../types/payments.types";

export async function getPaymentsApi(): Promise<PaymentsResponse> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiFetch<PaymentsResponse>("/api/payments", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function createPaymentApi(payload: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiPost<CreatePaymentResponse>("/api/payments", payload, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}
