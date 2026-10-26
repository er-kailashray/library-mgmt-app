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

export interface SeatMatrixBatchInfo {
    batch_id: number;
    batch_name: string;
    available: boolean;
    /** Null when the seat is free in this batch. */
    occupant?: SeatOccupant | null;
}

export interface SeatMatrixSeat {
    seat_id: number;
    seat_number: string;
    batches: SeatMatrixBatchInfo[];
}

export interface SeatMatrixResponse {
    status: boolean;
    data: {
        batches: MatrixBatchRef[];
        seats: SeatMatrixSeat[];
    };
}
