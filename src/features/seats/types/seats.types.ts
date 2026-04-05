export interface MatrixBatchRef {
    id: number;
    name: string;
}

export interface SeatMatrixBatchInfo {
    batch_id: number;
    batch_name: string;
    available: boolean;
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
