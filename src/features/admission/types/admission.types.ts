export interface AdmissionAllocation {
    batch_id: number;
    seat_id: number;
}

export interface CreateAdmissionRequest {
    name: string;
    phone: string;
    allocations: AdmissionAllocation[];
}
