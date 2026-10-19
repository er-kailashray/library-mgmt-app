export interface Theme {
	background: string;
	foreground: string;
	card: string;
	muted: string;
	mutedForeground: string;
	primary: string;
	accent: string;
	border: string;
	success: string;
	destructive: string;
	subscription: string;
	primarySurface: string;
}

export const light: Theme = {
	background: "#FDFCF9",
	foreground: "#1C1917",
	card: "#FFFFFF",
	muted: "#F4F4F0",
	mutedForeground: "#78716C",
	primary: "#171614",
	accent: "#E26D4D",
	border: "rgba(0, 0, 0, 0.05)",
	success: "#10B981",
	destructive: "#EF4444",
	subscription: "#14B8A6",
	primarySurface: "#171614",
};

export const dark: Theme = {
	background: "#0C0A09",
	foreground: "#FDFCF9",
	card: "#171615",
	muted: "#262626",
	mutedForeground: "#A8A29E",
	primary: "#FAFAF9",
	accent: "#E26D4D",
	border: "rgba(255, 255, 255, 0.1)",
	success: "#10B981",
	destructive: "#EF4444",
	subscription: "#14B8A6",
	primarySurface: "#1C1917",
};

export const colors = light;
