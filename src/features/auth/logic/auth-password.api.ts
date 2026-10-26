import { apiPost } from "@/services/api/client";
import { ResendOtpResponse } from "../types/auth.types";

/**
 * Executes the POST /api/forgot-password request: sends a reset code to the owner's phone.
 * Also used to resend; the backend answers 429 with `retry_after` when asked too soon.
 */
export async function forgotPasswordApi(phone: string) {
	return apiPost<ResendOtpResponse>("/api/forgot-password", { phone });
}

/**
 * Executes the POST /api/reset-password request. Every signed-in device is logged out,
 * so the owner signs in again with the new password.
 */
export async function resetPasswordApi(phone: string, otp: string, password: string) {
	return apiPost<{ message: string }>("/api/reset-password", {
		phone,
		otp,
		password,
		password_confirmation: password,
	});
}
