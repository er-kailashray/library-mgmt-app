export enum MemberStatus {
    ACTIVE = "ACTIVE",
    EXPIRING_SOON = "EXPIRING_SOON",
    EXPIRED = "EXPIRED",
}

export type Gender = "male" | "female" | "other";

export const GENDER_LABELS: Record<Gender, string> = {
    male: "Male",
    female: "Female",
    other: "Other",
};

export const GENDER_OPTIONS: { value: Gender; label: string }[] = (Object.keys(GENDER_LABELS) as Gender[]).map((value) => ({
    value,
    label: GENDER_LABELS[value],
}));

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
    gender: Gender | null;
    status: "active" | "inactive";
    payment_status: "Paid" | "Due" | string;
    due_amount: number | null;
    id_proof_type: "aadhaar" | "pan" | "voter_id_dl" | "student_id" | "other" | null;
    has_id_proof_front: boolean;
    has_id_proof_back: boolean;
    allocations: MemberAllocation[];
}

export interface MemberDetailResponse {
    status: boolean;
    data: MemberDetail;
}
