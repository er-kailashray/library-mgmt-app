export interface DashboardData {
    library_name: string;
    library_address?: string | null;
    owner_name: string;
    owner_photo?: string | null; // absolute URL, if the owner has uploaded one

    total_seats: number;
    occupied_seats: number;

    total_members: number;

    /** Seats filled in each batch, in time order. */
    batch_occupancy: {
        id: number;
        name: string;
        start_time: string;
        end_time: string;
        occupied: number;
        /** Seats usable in this batch today: blocked seats are left out. */
        total: number;
        /** Seats blocked in this batch today. */
        blocked?: number;
        /** Checked in to this batch today (for the live batch card). */
        checked_in_today?: number;
    }[];

    monthly_collection: number;
    pending_collection: number;
    today_collection: number;
    expected_collection: number; // for progress bar
    /** "YYYY-MM" the collection figures above refer to (the server's current month). */
    collection_month: string;
    /**
     * This month's fees by status. Every active booking owes one fee per month on its renewal day:
     * expected = collected + due + upcoming. Arrears are months missed before this one.
     * (monthly_collection is cash received, which also includes advance/arrears payments.)
     */
    /** Cash received this month, split by which month's fees it paid for (parts add up to received). */
    month_cash: {
        received: number;
        for_this_month: number;
        for_earlier_months: number;
        in_advance: number;
    };
    month_fees: {
        expected: number;
        collected: number;
        due: number;
        due_members: number;
        upcoming: number;
        upcoming_members: number;
        arrears: number;
        arrears_members: number;
    };
    days_in_month: number;
    day_of_month: number;
    /** Collected last month up to the same day - so early-month totals aren't judged against a full month. */
    last_month_same_period: number;

    due_members_count: number;
    due_total: number;
    /** Most overdue first; a few of them, for naming on the Home dues card. */
    top_dues: {
        member_id: number;
        name: string;
        amount: number;
        days_overdue: number;
    }[];
    critical_dues_count: number;
    this_month_dues_count: number;

    upcoming_renewals: number;

    overdue_summary: {
        two_months_plus: number;
        one_month: number;
        due_this_week: number;
    };

    recent_payments: {
        member_id?: number;
        name: string;
        seat: number;
        amount: number;
        time_ago: string;
        /** PAID / PARTIAL / REFUNDED */
        status?: string;
        method?: string;
        date?: string;
        recorded_at?: string | null;
        period_start?: string | null;
        period_end?: string | null;
    }[];
}

export interface DashboardResponse {
    status: boolean;
    data: DashboardData;
}

export interface MonthlyCollection {
    month: string;
    collected: number;
    payments_count: number;
}

export interface MonthlyCollectionResponse {
    status: boolean;
    data: MonthlyCollection;
}
