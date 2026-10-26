import { apiPost } from "@/services/api/client";
import { RegisterRequest, ResendOtpResponse, VerifyOtpResponse } from "../types/auth.types";

/**
 * Executes the POST /api/register request.
 */
export async function registerApi(data: RegisterRequest) {
    return apiPost<any>("/api/register", data);
}

/**
 * Executes the POST /api/verify-otp request for a new registration.
 * On success the backend returns a token so the owner is signed straight in.
 */
export async function verifyRegisterOtpApi(phone: string, otp: string) {
    return apiPost<VerifyOtpResponse>("/api/verify-otp", { phone, otp, type: "register" });
}

/**
 * Executes the POST /api/resend-otp request. The backend enforces a short cooldown
 * and answers 429 with `retry_after` when asked too soon.
 */
export async function resendRegisterOtpApi(phone: string) {
    return apiPost<ResendOtpResponse>("/api/resend-otp", { phone, type: "register" });
}
