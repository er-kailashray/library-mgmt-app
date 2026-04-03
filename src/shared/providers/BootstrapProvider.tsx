import { createContext, useContext, useMemo, type ReactNode } from "react";

type BootstrapValue = {
	/** Whether onboarding was completed in a prior session. */
	onboardingComplete: boolean;
};

const BootstrapContext = createContext<BootstrapValue | null>(null);

export function BootstrapProvider({
	children,
	onboardingComplete,
}: {
	children: ReactNode;
	onboardingComplete: boolean;
}) {
	const value = useMemo(() => ({ onboardingComplete }), [onboardingComplete]);
	return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
}

export function useBootstrap(): BootstrapValue {
	const ctx = useContext(BootstrapContext);
	if (!ctx) {
		throw new Error("useBootstrap must be used within BootstrapProvider");
	}
	return ctx;
}
