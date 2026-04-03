/** Mirrors the user payload from the reference API after login /me. */
export interface AuthUser {
	id: string;
	name: string;
	phone: string;
	role: string;
}
