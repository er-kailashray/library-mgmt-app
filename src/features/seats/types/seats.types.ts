export interface MatrixBatchRef {
    id: number;
    name: string;
    monthly_fee: string;
    start_time: string;
    end_time: string;
}

/** Who holds a taken seat in a batch. */
export interface SeatOccupant {
    member_id: number;
    name: string | null;
    /** "YYYY-MM-DD" */
    renewal_date: string;
    /** Renewal date reached, so they owe for the new cycle. */
    is_due: boolean;
}

/** A seat taken out of use for a while (broken chair, repairs, kept for staff). */
export interface SeatBlock {
    id: number;
    /** Null when it covers every batch. */
    batch_id: number | null;
    all_batches: boolean;
    /** "YYYY-MM-DD", first blocked day. */
    starts_on: string;
    /** Last blocked day; null = until unblocked. */
    ends_on: string | null;
    reason: string | null;
}

export interface SeatMatrixBatchInfo {
    batch_id: number;
    batch_name: string;
    available: boolean;
    /** Null when the seat is free in this batch. */
    occupant?: SeatOccupant | null;
    /** In force today in this batch; such a seat isn't `available` but has no occupant. */
    blocked?: SeatBlock | null;
}

export interface SeatMatrixSeat {
    seat_id: number;
    seat_number: string;
    batches: SeatMatrixBatchInfo[];
    /** Blocks in force now or starting later, earliest first. */
    blocks?: SeatBlock[];
}

export interface SeatMatrixResponse {
    status: boolean;
    data: {
        batches: MatrixBatchRef[];
        seats: SeatMatrixSeat[];
    };
}
