export enum PaymentStatus {
    PAID = "PAID",
    PENDING = "PENDING",
    PARTIAL = "PARTIAL",
}

export interface Payment {
    id: string;
    member_name: string;
    amount: number;
    date: string;
    status: PaymentStatus;
    method: string;
}

export const DUMMY_PAYMENTS: Payment[] = [
    {
        id: "p1",
        member_name: "Kailash Ray",
        amount: 1500,
        date: "2024-04-01",
        status: PaymentStatus.PAID,
        method: "UPI (PhonePe)",
    },
    {
        id: "p2",
        member_name: "Arun Kumar",
        amount: 1200,
        date: "2024-04-02",
        status: PaymentStatus.PENDING,
        method: "—",
    },
    {
        id: "p3",
        member_name: "Suresh Raina",
        amount: 1500,
        date: "2024-03-25",
        status: PaymentStatus.PAID,
        method: "Cash",
    },
    {
        id: "p4",
        member_name: "Hardik Pandya",
        amount: 1000,
        date: "2024-04-05",
        status: PaymentStatus.PARTIAL,
        method: "UPI (Google Pay)",
    },
];
