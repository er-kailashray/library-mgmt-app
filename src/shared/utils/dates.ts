/** Date helpers for "YYYY-MM-DD" strings, using the phone's local calendar (no time zones involved). */

/** "YYYY-MM-DD" for a local date. */
export function toIsoDate(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Local midnight for "YYYY-MM-DD" (a longer timestamp is cut to its date). */
export function fromIsoDate(iso: string): Date {
	const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
	return new Date(y, m - 1, d);
}

export function todayIso(): string {
	return toIsoDate(new Date());
}

/** Plus whole months, clamped to the month's last day (31 Jan + 1 month = 28 Feb), like the backend. */
export function addMonths(iso: string, months: number): string {
	const date = fromIsoDate(iso);
	const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
	const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
	target.setDate(Math.min(date.getDate(), lastDay));
	return toIsoDate(target);
}

export function addDays(iso: string, days: number): string {
	const date = fromIsoDate(iso);
	date.setDate(date.getDate() + days);
	return toIsoDate(date);
}

/** "22 Oct", or "22 Oct 2026" with the year. */
export function formatShortDate(iso: string, withYear = false): string {
	return fromIsoDate(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}

/**
 * How long ago a date was, to the day: "today", "5 days", "4 months 13 days", "1 year 2 months".
 * Days are left out once it's over a year, where they no longer add anything.
 */
export function durationSince(iso: string): string {
	const from = fromIsoDate(iso);
	const now = fromIsoDate(todayIso());
	if (now <= from) return "today";

	let months = (now.getFullYear() - from.getFullYear()) * 12 + (now.getMonth() - from.getMonth());
	if (now.getDate() < from.getDate()) months -= 1;
	// Days left over after the whole months (same day-of-month rules as addMonths).
	const afterMonths = fromIsoDate(addMonths(iso, months));
	const days = Math.round((now.getTime() - afterMonths.getTime()) / 86_400_000);

	const years = Math.floor(months / 12);
	const restMonths = months % 12;
	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
	return [
		years ? plural(years, "year") : "",
		restMonths ? plural(restMonths, "month") : "",
		days && !years ? plural(days, "day") : "",
	]
		.filter(Boolean)
		.join(" ");
}
