import { Ionicons } from "@expo/vector-icons";

import { formatShortDate } from "@/shared/utils/dates";

/** How each kind of payment entry looks wherever payments are listed (Payments, Home). */
export const PAYMENT_STATUS_LOOK: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; sign: string; color: (theme: any) => string }> = {
    PAID: { label: "Paid", icon: "checkmark-circle", sign: "+", color: (t) => t.success },
    PARTIAL: { label: "Partial", icon: "pie-chart", sign: "+", color: (t) => t.accent },
    PENDING: { label: "Due", icon: "time", sign: "", color: (t) => t.accent },
    REFUNDED: { label: "Refund", icon: "return-down-back", sign: "−", color: (t) => t.destructive },
};

/**
 * "24 Oct, 10:42 AM" when it was entered on the day it's dated; just "24 Oct" for one dated
 * another day (the time it was typed in wouldn't be when the money was taken).
 */
export function formatPaymentWhen(payment: { date: string; recorded_at?: string | null }): string {
    const day = formatShortDate(payment.date);
    if (!payment.recorded_at) return day;
    const recorded = new Date(payment.recorded_at);
    const recordedDay = `${recorded.getFullYear()}-${String(recorded.getMonth() + 1).padStart(2, "0")}-${String(recorded.getDate()).padStart(2, "0")}`;
    if (recordedDay !== payment.date.slice(0, 10)) return day;
    return `${day}, ${recorded.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()}`;
}

/** "Covers 1 Nov – 30 Nov 2026" / "Refund for 24 Oct – 30 Nov 2026"; empty when no period was recorded. */
export function describePaymentPeriod(payment: { status: string; period_start?: string | null; period_end?: string | null }): string {
    if (!payment.period_start || !payment.period_end) return "";
    return `${payment.status === "REFUNDED" ? "Refund for" : "Covers"} ${formatShortDate(payment.period_start)} – ${formatShortDate(payment.period_end, true)}`;
}
