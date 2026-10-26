/** "Good morning" / "Good afternoon" / "Good evening" for the hour. */
export function greetingFor(date: Date): string {
	const hour = date.getHours();
	if (hour < 5) return "Working late";
	if (hour < 12) return "Good morning";
	if (hour < 17) return "Good afternoon";
	return "Good evening";
}

/** "MON, 26 OCT" for the header's date line. */
export function formatHeaderDate(date: Date): string {
	const weekday = date.toLocaleDateString("en-IN", { weekday: "short" });
	const month = date.toLocaleDateString("en-IN", { month: "short" });
	return `${weekday}, ${date.getDate()} ${month}`.toUpperCase();
}

/** "Kailash" from "Kailash Ray". */
export function firstName(name: string | null | undefined): string {
	return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/** "YYYY-MM" shifted by whole months. */
export function shiftMonth(month: string, delta: number): string {
	const [year, monthIndex] = month.split("-").map(Number);
	const date = new Date(year, monthIndex - 1 + delta, 1);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** "Oct 2026" */
export function formatMonth(month: string): string {
	return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/** "October" */
export function formatMonthName(month: string): string {
	return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long" });
}

/** "Due today", "4 days late", "2 months late". */
export function formatLateness(daysOverdue: number): string {
	if (daysOverdue <= 0) return "Due today";
	if (daysOverdue < 30) return `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} late`;
	const months = Math.floor(daysOverdue / 30);
	return `${months} month${months === 1 ? "" : "s"} late`;
}

/** Percent change from `before` to `now`, or null when there's nothing to compare against. */
export function percentChange(now: number, before: number): number | null {
	if (before <= 0) return null;
	return Math.round(((now - before) / before) * 100);
}
