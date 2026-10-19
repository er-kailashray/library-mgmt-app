export enum MemberStatus {
    ACTIVE = "ACTIVE",
    EXPIRING_SOON = "EXPIRING_SOON",
    EXPIRED = "EXPIRED",
}

export interface Member {
    id: number | string;
    name: string;
    phone: string;
    payment_status: "Paid" | "Due" | string;
    active_allocations_count: number;
    // UI-only derived fields
    initials?: string;
}

export interface MembersResponse {
    status: boolean;
    data: Member[];
}

export interface MemberAllocation {
    batch_id: number;
    batch_name: string;
    seat_id: number;
    seat_number: number | string;
    renewal_date: string;
}

export interface MemberDetail {
    id: number | string;
    name: string;
    phone: string;
    status: "active" | "inactive";
    payment_status: "Paid" | "Due" | string;
    due_amount: number | null;
    allocations: MemberAllocation[];
}

export interface MemberDetailResponse {
    status: boolean;
    data: MemberDetail;
}
