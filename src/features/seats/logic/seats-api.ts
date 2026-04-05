import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiFetch } from "@/services/api/client";
import { SeatMatrixResponse } from "../types/seats.types";

export async function getSeatMatrixApi(): Promise<SeatMatrixResponse> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiFetch<SeatMatrixResponse>("/api/seat-matrix", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}
