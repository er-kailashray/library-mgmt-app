import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiFetch, apiPost, apiUrl } from "@/services/api/client";
import { uploadImage } from "@/shared/utils/image-upload";
import { Amenity, LibraryLocation, LibraryProfileResponse } from "../types/library-profile.types";

async function authHeaders(): Promise<{ Authorization: string }> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");
    return { Authorization: `Bearer ${token}` };
}

export async function getLibraryProfileApi(): Promise<LibraryProfileResponse> {
    return apiFetch<LibraryProfileResponse>("/api/library", { headers: await authHeaders() });
}

export async function updateLibraryProfileApi(payload: { library_name: string; total_seats: number }): Promise<LibraryProfileResponse> {
    return apiPost<LibraryProfileResponse>("/api/library/update", payload, { headers: await authHeaders() });
}

export async function updateLibraryAmenitiesApi(amenities: Amenity[]): Promise<LibraryProfileResponse> {
    return apiPost<LibraryProfileResponse>("/api/library/amenities", { amenities }, { headers: await authHeaders() });
}

export async function updateLibraryLocationApi(location: LibraryLocation): Promise<LibraryProfileResponse> {
    return apiPost<LibraryProfileResponse>("/api/library/location", location, { headers: await authHeaders() });
}

export async function uploadLibraryPhotoApi(uri: string): Promise<{ status: boolean; message?: string; data: { id: number; url: string } }> {
    const headers = await authHeaders();
    const result = await uploadImage(apiUrl("/api/library/photos"), uri, {
        fieldName: "photo",
        headers: { ...headers, Accept: "application/json" },
    });

    const body = result.body ? JSON.parse(result.body) : null;
    if (result.status < 200 || result.status >= 300) {
        throw new Error(body?.message ?? "Failed to upload photo.");
    }
    return body;
}

export async function deleteLibraryPhotoApi(id: number): Promise<{ status: boolean; message?: string }> {
    return apiFetch(`/api/library/photos/${id}`, { method: "DELETE", headers: await authHeaders() });
}
