/** Mirrors the user payload from the reference API after login /me. */
export interface AuthUser {
	id: string;
	name: string;
	phone: string;
	role: string;
	profile_photo_url?: string | null;
}

/** Registration Payload */
export interface RegisterRequest {
	name: string;
	phone: string;
	password: string;
	library_name: string;
	total_seats: string;
}

/** Response of POST /api/verify-otp for the register flow. */
export interface VerifyOtpResponse {
	message: string;
	token: string;
	user: AuthUser;
}

/** Response of POST /api/resend-otp; `retry_after` is the cooldown in seconds. */
export interface ResendOtpResponse {
	message: string;
	retry_after: number;
}
