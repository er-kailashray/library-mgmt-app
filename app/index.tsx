import { Redirect } from "expo-router";

import { useBootstrap } from "@/shared/providers/BootstrapProvider";

export default function Index() {
	const { onboardingComplete } = useBootstrap();

	if (onboardingComplete) {
		return <Redirect href="/login" />;
	}

	return <Redirect href="/onboarding" />;
}
