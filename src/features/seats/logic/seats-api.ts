import { getStoredAuthToken } from "@/services/api/auth.api";
import { apiFetch, apiPost } from "@/services/api/client";
import { SeatBlock, SeatMatrixResponse } from "../types/seats.types";

export async function getSeatMatrixApi(): Promise<SeatMatrixResponse> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiFetch<SeatMatrixResponse>("/api/seat-matrix", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export type BlockSeatPayload = {
    /** Leave out to block the seat in every batch. */
    batch_ids?: number[];
    /** "YYYY-MM-DD"; defaults to today. */
    starts_on?: string;
    /** Last blocked day; leave out for "until unblocked". */
    ends_on?: string;
    reason?: string;
};

/** Takes a seat out of use (all batches or some) for a while. */
export async function blockSeatApi(seatId: number, payload: BlockSeatPayload): Promise<{ status: boolean; message?: string; data: SeatBlock[] }> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiPost(`/api/seats/${seatId}/block`, payload, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

/** Puts a blocked seat back in use from today (or drops a block that hasn't started). */
export async function unblockSeatApi(blockId: number): Promise<{ status: boolean; message?: string }> {
    const token = await getStoredAuthToken();
    if (!token) throw new Error("No auth token");

    return apiFetch(`/api/seat-blocks/${blockId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}
