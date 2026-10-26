export type ReportMonths = 3 | 6 | 12;

export interface RevenueMonth {
    month: string; // "YYYY-MM"
    label: string; // "Nov"
    /** Net of refunds. */
    collected: number;
    refunded: number;
    payments_count: number;
}

export interface RevenueByMode {
    mode: string;
    label: string;
    amount: number;
    count: number;
}

export interface DuesAge {
    key: string;
    label: string;
    members: number;
    amount: number;
}

export interface MembersMonth {
    month: string;
    label: string;
    joined: number;
    left: number;
    /** Members holding a seat at the month's end (today for the current month). */
    active: number;
}

export interface BatchOccupancy {
    batch_id: number;
    name: string;
    start_time: string;
    end_time: string;
    occupied: number;
    total: number;
    rate: number;
}

export interface BatchAttendance {
    batch_id: number;
    name: string;
    enrolled: number;
    marked_days: number;
    /** Null when attendance wasn't taken for this batch in the window. */
    average_present: number | null;
    rate: number | null;
}

export interface NotSeenMember {
    member_id: number;
    name: string;
    /** Null = never checked in since starting. */
    last_seen: string | null;
    days: number;
}

export interface ReportData {
    months: ReportMonths;
    from: string;
    to: string;
    revenue: {
        by_month: RevenueMonth[];
        total: number;
        this_month: number;
        last_month: number;
        change_pct: number | null;
        by_mode: RevenueByMode[];
    };
    dues: {
        total_outstanding: number;
        overdue_members: number;
        by_age: DuesAge[];
        /** Collected this month ÷ (collected + still owed), as a %. */
        collection_rate: number | null;
    };
    members: {
        active: number;
        by_month: MembersMonth[];
        occupancy: BatchOccupancy[];
    };
    attendance: {
        window_days: number;
        tracked: boolean;
        by_batch: BatchAttendance[];
        not_seen: { after_days?: number; count: number; members: NotSeenMember[] };
    };
}

export interface ReportResponse {
    status: boolean;
    data: ReportData;
}
