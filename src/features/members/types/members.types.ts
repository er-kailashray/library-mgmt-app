export enum MemberStatus {
    ACTIVE = "ACTIVE",
    EXPIRING_SOON = "EXPIRING_SOON",
    EXPIRED = "EXPIRED",
}

export interface Member {
    id: string;
    name: string;
    phone: string;
    batch_id: number;
    batch_name: string;
    expiry_date: string;
    status: MemberStatus;
    initials: string;
}

export const DUMMY_MEMBERS: Member[] = [
    {
        id: "1",
        name: "Kailash Ray",
        phone: "9941656985",
        batch_id: 1,
        batch_name: "Morning Batch (7-11)",
        expiry_date: "2026-05-10",
        status: MemberStatus.ACTIVE,
        initials: "KR",
    },
    {
        id: "2",
        name: "Arun Kumar",
        phone: "9876543210",
        batch_id: 2,
        batch_name: "Afternoon Batch (12-4)",
        expiry_date: "2026-04-10",
        status: MemberStatus.EXPIRING_SOON,
        initials: "AK",
    },
    {
        id: "3",
        name: "Suresh Raina",
        phone: "9000012345",
        batch_id: 1,
        batch_name: "Morning Batch (7-11)",
        expiry_date: "2026-03-25",
        status: MemberStatus.EXPIRED,
        initials: "SR",
    },
    {
        id: "4",
        name: "Hardik Pandya",
        phone: "9123456789",
        batch_id: 3,
        batch_name: "Evening Batch (5-9)",
        expiry_date: "2026-06-15",
        status: MemberStatus.ACTIVE,
        initials: "HP",
    },
    {
        id: "5",
        name: "Shikhar Dhawan",
        phone: "9888877777",
        batch_id: 2,
        batch_name: "Afternoon Batch (12-4)",
        expiry_date: "2026-04-05",
        status: MemberStatus.EXPIRING_SOON,
        initials: "SD",
    },
];
