/** AsyncStorage keys (shared across features). */
export const STORAGE_KEYS = {
	onboardingComplete: "@librum/onboarding_complete",
	authToken: "@librum/auth_token",
	authUser: "@librum/auth_user",
	/** Prefix; the owner's user id is appended so each account keeps its own state. */
	setupCelebration: "@librum/setup_celebration:",
} as const;
