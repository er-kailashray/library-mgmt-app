import { apiPost } from "@/services/api/client";
import { RegisterRequest, ResendOtpResponse, VerifyOtpResponse } from "../types/auth.types";

/**
 * The sign-up in progress on this device. The backend hands it out with the code (after
 * registering, or signing in to an account that isn't verified yet) and only accepts the code
 * together with it, so registering the same number on another phone voids this one. Kept in
 * memory: after an app restart, signing in again gets a fresh one.
 */
let pendingRegistrationToken: string | null = null;

export function setPendingRegistrationToken(token: string | null | undefined): void {
    pendingRegistrationToken = token ?? null;
}

/**
 * Executes the POST /api/register request.
 */
export async function registerApi(data: RegisterRequest) {
    const response = await apiPost<{ message: string; registration_token?: string }>("/api/register", data);
    setPendingRegistrationToken(response.registration_token);
    return response;
}

/**
 * Executes the POST /api/verify-otp request for a new registration.
 * On success the backend returns a token so the owner is signed straight in.
 */
export async function verifyRegisterOtpApi(phone: string, otp: string) {
    const response = await apiPost<VerifyOtpResponse>("/api/verify-otp", {
        phone,
        otp,
        type: "register",
        registration_token: pendingRegistrationToken ?? undefined,
    });
    setPendingRegistrationToken(null);
    return response;
}

/**
 * Executes the POST /api/resend-otp request. The backend enforces a short cooldown
 * and answers 429 with `retry_after` when asked too soon.
 */
export async function resendRegisterOtpApi(phone: string) {
    return apiPost<ResendOtpResponse>("/api/resend-otp", { phone, type: "register" });
}
