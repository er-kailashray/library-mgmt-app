import type { ReactNode } from "react";
import { StyleProp, View, ViewStyle } from "react-native";

import { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";

type PoweredByProps = {
	style?: StyleProp<ViewStyle>;
	/** Extra lines under the credit, e.g. the app version on Settings. */
	children?: ReactNode;
};

/**
 * "POWERED BY KAILASH RAY" credit used at the foot of screens. In a scroll view with
 * `flexGrow: 1` it sits at the bottom of the screen, and below the content once it scrolls.
 */
export function PoweredBy({ style, children }: PoweredByProps) {
	const { theme } = useTheme();
	const styles = createStyles(theme);

	return (
		<View style={[styles.block, style]}>
			<Text style={styles.text}>
				POWERED BY <Text style={styles.name}>KAILASH RAY</Text>
			</Text>
			{children}
		</View>
	);
}

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		block: {
			alignItems: "center",
			marginTop: "auto",
			paddingTop: 32,
			gap: 4,
		},
		text: {
			fontFamily: "sans-semibold",
			color: theme.mutedForeground,
			fontSize: 11,
			letterSpacing: 1.5,
		},
		name: {
			fontFamily: "sans-extrabold",
			color: theme.primary,
		},
	});
