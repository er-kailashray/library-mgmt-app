import { formatTimeRange, runsPastMidnight, toMinutes } from "@/features/batches/logic/batch-time";
import { MatrixBatchRef, SeatMatrixSeat } from "@/features/seats/types/seats.types";

/** "12" from "12", "012" or "S-12"; seat numbers are shown without padding or prefixes. */
export function seatNumber(value: string | number): string {
    const digits = String(value ?? "").replace(/\D/g, "");
    return String(parseInt(digits || "0", 10));
}

export function seatLabel(value: string | number): string {
    return `Seat ${seatNumber(value)}`;
}

/** "8 AM – 12 PM" (minutes only when they aren't :00). */
export function batchTimeLabel(batch: Pick<MatrixBatchRef, "start_time" | "end_time">): string {
    return formatTimeRange(batch.start_time, batch.end_time);
}

/** Whether a batch is on right now, including ones that run past midnight. */
export function isRunningNow(batch: Pick<MatrixBatchRef, "start_time" | "end_time">, now = new Date()): boolean {
    const minutes = now.getHours() * 60 + now.getMinutes();
    const start = toMinutes(batch.start_time);
    const end = toMinutes(batch.end_time);
    return runsPastMidnight(batch.start_time, batch.end_time) ? minutes >= start || minutes < end : minutes >= start && minutes < end;
}

/** How many batches this seat is free in, out of how many there are. */
export function freeBatches(seat: SeatMatrixSeat): { free: number; total: number } {
    return { free: seat.batches.filter((b) => b.available).length, total: seat.batches.length };
}
