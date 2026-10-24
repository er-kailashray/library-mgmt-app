export enum PaymentStatus {
    PAID = "PAID",
    PENDING = "PENDING",
    PARTIAL = "PARTIAL",
    /** Money given back when a member left; the amount is negative. */
    REFUNDED = "REFUNDED",
}

export interface PaymentSeat {
    batch_name: string | null;
    seat_number: number | null;
}

export interface Payment {
    id: string;
    member_id: number | string;
    member_name: string;
    member_status: "active" | "inactive";
    amount: number;
    date: string;
    /** When it was entered in the app (ISO), for showing the time it was taken. */
    recorded_at?: string | null;
    /** Days the payment pays for (or a refund gives back); null for payments recorded before this was tracked. */
    period_start?: string | null;
    period_end?: string | null;
    /** The seats it was for, as they were when it was recorded; null when unknown. */
    seats?: PaymentSeat[] | null;
    status: PaymentStatus;
    method: string;
}

export interface PaymentsResponse {
    status: boolean;
    data: Payment[];
}

export type PaymentMode = "cash" | "upi" | "bank_transfer";

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
    cash: "Cash",
    upi: "UPI",
    bank_transfer: "Bank Transfer",
};

export interface CreatePaymentRequest {
    member_id: number | string;
    amount: number;
    payment_mode?: PaymentMode;
    notes?: string;
    /** Back after a break: restart on this date ("YYYY-MM-DD"); the days in between aren't charged. */
    start_date?: string;
}

export interface CreatePaymentResponse {
    status: boolean;
    message?: string;
    data: Payment;
}
