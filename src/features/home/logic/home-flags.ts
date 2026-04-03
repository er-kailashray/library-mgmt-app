/**
 * Temporary flags until the API exposes library / batch state.
 * Example: `GET /me/library` → `{ hasBatches: boolean, name: string, ... }`
 */
export const MOCK_OWNER_HAS_BATCHES = false;

export const MOCK_OWNER_NAME = "Library owner";
export const MOCK_LIBRARY_NAME = "My library";

/** Placeholder for dashboard summary (e.g. monthly collections). */
export const MOCK_MONTH_EARNINGS_CENTS: number | null = MOCK_OWNER_HAS_BATCHES ? 1250000 : null;
