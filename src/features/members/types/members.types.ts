import { Payment } from "@/features/payments/types/payments.types";

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
    /** "YYYY-MM-DD" they joined. */
    join_date: string | null;
    status: "active" | "inactive";
    payment_status: "Paid" | "Due" | string;
    active_allocations_count: number;
    /** Where they sit now, one per batch in the day's order; empty for members who left. */
    seats?: MemberSeat[];
    /** What they owe now and for how long; null when nothing is due. */
    due_amount?: number | null;
    days_overdue?: number | null;
    /** Earliest renewal across their seats ("YYYY-MM-DD"); null without a seat. */
    next_renewal_date?: string | null;
    /** For members who left: when their last seat ended. */
    left_on?: string | null;
    /** Owed when the member left; 0 for active members. */
    outstanding_balance: number;
    // UI-only derived fields
    initials?: string;
}

export interface MemberSeat {
    batch_id: number;
    batch_name: string | null;
    start_time: string | null;
    end_time: string | null;
    seat_number: number | string | null;
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

export interface RefundOptions {
    /** Everything paid for time not yet over. */
    full: number;
    /** The unused days' share of the monthly fee. */
    partial: number;
    unused_days: number;
    paid_through: string;
}

export interface MemberDetail {
    id: number | string;
    name: string;
    phone: string;
    gender: Gender | null;
    /** For the owner's records only. */
    address: string | null;
    /** "YYYY-MM-DD" they joined. */
    join_date: string | null;
    status: "active" | "inactive";
    payment_status: "Paid" | "Due" | string;
    due_amount: number | null;
    /** Owed when the member left (inactive members); collected or waived on readmission. */
    outstanding_balance: number;
    /** Combined monthly fee of the member's active batches. */
    monthly_fee: number;
    /** Pre-fill for "Record Payment / Renew"; null when the member has no active seat. */
    suggested_payment: number | null;
    /** Paid up to (not including) this "YYYY-MM-DD"; a new payment's period starts here. */
    paid_through: string | null;
    /** Earlier partial payments that count toward the next full fee. */
    partial_credit: number;
    /** What "Mark as left" can give back; null when no paid days are left. */
    refund_options: RefundOptions | null;
    /** Newest first. */
    payments: Payment[];
    id_proof_type: "aadhaar" | "pan" | "voter_id_dl" | "student_id" | "other" | null;
    has_id_proof_front: boolean;
    has_id_proof_back: boolean;
    allocations: MemberAllocation[];
    /** Every seat they've had, newest first, including ended ones and ones in deleted batches. */
    seat_history: SeatHistoryEntry[];
}

export interface SeatHistoryEntry {
    batch_name: string | null;
    seat_number: number | null;
    start_date: string;
    /** Null while the seat is still theirs. */
    ended_on: string | null;
    status: "active" | "ended";
}

export interface MemberDetailResponse {
    status: boolean;
    data: MemberDetail;
}
