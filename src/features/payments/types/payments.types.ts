export enum PaymentStatus {
    PAID = "PAID",
    PENDING = "PENDING",
    PARTIAL = "PARTIAL",
}

export interface Payment {
    id: string;
    member_id: number | string;
    member_name: string;
    amount: number;
    date: string;
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
}

export interface CreatePaymentResponse {
    status: boolean;
    message?: string;
    data: Payment;
}
