export type AttendanceStatus = "present" | "absent";

export interface AttendanceMember {
    member_id: number;
    name: string;
    seat_number: number | string | null;
    /** "absent" also when the batch ended without a check-in (see auto_absent). */
    status: AttendanceStatus | null;
    /** Absent only because the batch is over and they never checked in. */
    auto_absent: boolean;
    /** Arrival time "HH:MM", when present. */
    check_in_at: string | null;
    /** They came to a different batch that day instead. */
    elsewhere: { batch_name: string; check_in_at: string | null } | null;
}

/** Someone seated in another batch who came to this one that day. */
export interface AttendanceVisitor {
    member_id: number;
    name: string;
    check_in_at: string | null;
}

export interface AttendanceBatch {
    batch_id: number;
    batch_name: string;
    /** "HH:MM" */
    start_time: string;
    end_time: string;
    is_running: boolean;
    has_ended: boolean;
    present_count: number;
    members: AttendanceMember[];
    visitors: AttendanceVisitor[];
}

export interface AttendanceRoster {
    date: string;
    /** Earliest "YYYY-MM-DD" that can still be marked or corrected (the last 7 days). */
    editable_from: string;
    /**
     * The session on right now and the day it belongs to; after midnight an overnight batch
     * (10 PM - 2 AM) is still the previous day's. Null when nothing is running.
     */
    live_session?: { date: string; batch_id: number } | null;
    batches: AttendanceBatch[];
}

export interface AttendanceRosterResponse {
    status: boolean;
    data: AttendanceRoster;
}

export interface MarkAttendanceRequest {
    member_id: number;
    batch_id: number;
    /** "YYYY-MM-DD"; today if omitted. */
    date?: string;
    status: AttendanceStatus;
    /** Arrival "HH:MM"; now if omitted (today only - required for an earlier day). */
    check_in_at?: string;
}

export interface ClearAttendanceRequest {
    member_id: number;
    batch_id: number;
    date?: string;
}
