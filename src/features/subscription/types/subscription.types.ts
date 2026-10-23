export type SubscriptionStateKey = "trial" | "active" | "grace" | "expired";

export interface SubscriptionPlan {
    code: "monthly" | "yearly" | string;
    name: string;
    price: number;
    duration_months: number;
    /** price / duration_months, for showing the yearly saving. */
    monthly_equivalent: number;
}

export interface SubscriptionInfo {
    /** trial and active = full access; grace = ended recently, still full access; expired = read-only. */
    state: SubscriptionStateKey;
    can_write: boolean;
    plan: SubscriptionPlan | null;
    starts_at: string;
    ends_at: string;
    grace_ends_at: string;
    /** Days until access changes: to ends_at, or in grace to grace_ends_at. */
    days_left: number;
    plans: SubscriptionPlan[];
}

export interface SubscriptionResponse {
    status: boolean;
    data: SubscriptionInfo;
}

/** Days before the end of a trial/plan when Home starts nudging the owner to subscribe. */
export const SUBSCRIPTION_NUDGE_DAYS = 7;
