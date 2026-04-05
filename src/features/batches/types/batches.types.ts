export interface Batch {
    id: number;
    library_id: number;
    name: string;
    start_time: string;
    end_time: string;
    monthly_fee: string;
    allocations_count: number;
    total_seats: number;
    created_at: string;
    updated_at: string;
}

export interface CreateBatchRequest {
    name: string;
    start_time: string;
    end_time: string;
    monthly_fee: string;
}

export interface GetBatchesResponse {
    status: boolean;
    data: Batch[];
}
