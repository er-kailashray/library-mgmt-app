export type AttendanceStatus = "present" | "absent";

export interface AttendanceMember {
    member_id: number;
    name: string;
    seat_number: number | string;
    status: AttendanceStatus | null;
}

export interface AttendanceBatch {
    batch_id: number;
    batch_name: string;
    members: AttendanceMember[];
}

export interface AttendanceRoster {
    date: string;
    batches: AttendanceBatch[];
}

export interface AttendanceRosterResponse {
    status: boolean;
    data: AttendanceRoster;
}

export interface MarkAttendanceRequest {
    member_id: number;
    batch_id: number;
    date?: string;
    status: AttendanceStatus;
}
