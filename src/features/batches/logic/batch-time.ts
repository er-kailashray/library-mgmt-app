import { Batch } from "../types/batches.types";

/** Batches start and end on these minutes; the backend refuses anything else. */
export const MINUTE_STEPS = [0, 15, 30, 45] as const;

const DAY_MINUTES = 24 * 60;

/** Minutes since midnight for an "HH:MM[:SS]" time. */
export function toMinutes(time: string): number {
	const [h, m] = time.split(":").map(Number);
	return h * 60 + (m || 0);
}

/** "HH:MM" (24h) from minutes since midnight. */
export function fromMinutes(minutes: number): string {
	const wrapped = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
	return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/** "5:00 AM" from "05:00" or "05:00:00". */
export function formatTime(time: string): string {
	const minutes = toMinutes(time);
	const h = Math.floor(minutes / 60);
	return `${h % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** An end at or before the start means the batch runs past midnight. */
export function runsPastMidnight(start: string, end: string): boolean {
	return toMinutes(end) <= toMinutes(start);
}

/** "5 h 30 min" between start and end, counting past midnight. */
export function durationLabel(start: string, end: string): string {
	const total = (toMinutes(end) - toMinutes(start) + DAY_MINUTES) % DAY_MINUTES;
	const hours = Math.floor(total / 60);
	const minutes = total % 60;
	return [hours ? `${hours} h` : "", minutes ? `${minutes} min` : ""].filter(Boolean).join(" ");
}

/** Minute ranges within one day; an overnight batch is split at midnight. */
function segments(start: string, end: string): [number, number][] {
	const from = toMinutes(start);
	const to = toMinutes(end);
	return from < to ? [[from, to]] : [[from, DAY_MINUTES], [0, to]];
}

/** Same rule as the backend: two batches clash if they share any minute of the day. */
export function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
	return segments(startA, endA).some(([fromA, toA]) => segments(startB, endB).some(([fromB, toB]) => fromA < toB && fromB < toA));
}

/** The existing batch a new start/end would clash with, if any. */
export function findClash(batches: Batch[], start: string, end: string): Batch | null {
	return batches.find((b) => timesOverlap(start, end, b.start_time, b.end_time)) ?? null;
}
