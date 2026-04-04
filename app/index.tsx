import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

import { getStoredAuthToken } from "@/services/api/auth.api";
import { useBootstrap } from "@/shared/providers/BootstrapProvider";

export default function Index() {
	const { onboardingComplete } = useBootstrap();

	// Check for existing auth token
	const checkAuth = async () => {
		try {
			const token = await getStoredAuthToken();
			return !!token;
		} catch {
			return false;
		}
	};

	const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

	useEffect(() => {
		checkAuth().then(setIsAuthenticated);
	}, []);

	if (isAuthenticated === null) {
		// Still checking auth
		return null;
	}

	if (!onboardingComplete) {
		return <Redirect href="/onboarding" />;
	}

	if (isAuthenticated) {
		return <Redirect href="/home" />;
	}

	return <Redirect href="/login" />;
}
