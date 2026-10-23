import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";

import { setSubscriptionExpiredHandler } from "@/services/api/subscription-guard";

export default function AppGroupLayout() {
	const router = useRouter();

	// Any change refused because the subscription expired (read-only mode) opens the plans screen.
	useEffect(() => {
		setSubscriptionExpiredHandler(() => router.push("/subscription"));
		return () => setSubscriptionExpiredHandler(null);
	}, [router]);

	return <Stack screenOptions={{ headerShown: false }} />;
}
