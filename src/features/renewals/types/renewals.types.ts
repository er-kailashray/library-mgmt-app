export interface UpcomingRenewal {
    member_id: number;
    name: string;
    phone: string;
    amount: number;
    renewal_date: string;
    days_until_renewal: number;
}

export interface UpcomingRenewalsData {
    window_days: number;
    renewals: UpcomingRenewal[];
}

export interface UpcomingRenewalsResponse {
    status: boolean;
    data: UpcomingRenewalsData;
}

export interface BulkRenewalReminderResult {
    sent: number;
    failed: number;
    failed_members: string[];
}
