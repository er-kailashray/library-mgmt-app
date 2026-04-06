/** Mirrors the user payload from the reference API after login /me. */
export interface AuthUser {
	id: string;
	name: string;
	phone: string;
	role: string;
}

/** Registration Payload */
export interface RegisterRequest {
	name: string;
	phone: string;
	password: string;
	library_name: string;
	total_seats: string;
}
