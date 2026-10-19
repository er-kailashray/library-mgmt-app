export interface DashboardData {
    library_name: string;
    owner_name: string;

    total_seats: number;
    occupied_seats: number;

    total_members: number;

    monthly_collection: number;
    pending_collection: number;
    today_collection: number;
    expected_collection: number; // for progress bar

    due_members_count: number;
    critical_dues_count: number;
    this_month_dues_count: number;

    upcoming_renewals: number;

    overdue_summary: {
        two_months_plus: number;
        one_month: number;
        due_this_week: number;
    };

    recent_payments: {
        name: string;
        seat: number;
        amount: number;
        time_ago: string;
    }[];
}

export interface DashboardResponse {
    status: boolean;
    data: DashboardData;
}
