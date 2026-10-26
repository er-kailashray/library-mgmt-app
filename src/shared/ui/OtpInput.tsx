import { useRef } from "react";
import { Pressable, StyleSheet, TextInputInstance, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text, TextInput } from "@/shared/ui/Text";

type OtpInputProps = {
	value: string;
	onChangeText: (value: string) => void;
	length?: number;
};

/**
 * One box per digit, drawn with plain Views over an invisible TextInput.
 *
 * The TextInput deliberately has no letterSpacing/textAlign: Android (new architecture)
 * recycles native TextInputs, and a spaced-out code field leaked its spacing into the next
 * screen's inputs (e.g. Register, Login), stretching their placeholders.
 */
export function OtpInput({ value, onChangeText, length = 6 }: OtpInputProps) {
	const { theme } = useTheme();
	const inputRef = useRef<TextInputInstance>(null);
	const styles = createStyles(theme);

	return (
		<Pressable style={styles.row} onPress={() => inputRef.current?.focus()} accessibilityLabel="Verification code">
			{Array.from({ length }, (_, i) => {
				const isActive = i === Math.min(value.length, length - 1);
				return (
					<View key={i} style={[styles.box, isActive && styles.boxActive]}>
						<Text style={[styles.digit, !value[i] && styles.digitPlaceholder]}>{value[i] ?? "0"}</Text>
					</View>
				);
			})}
			<TextInput
				ref={inputRef}
				style={styles.hiddenInput}
				value={value}
				onChangeText={(text) => onChangeText(text.replace(/\D/g, "").slice(0, length))}
				keyboardType="number-pad"
				textContentType="oneTimeCode"
				autoComplete="sms-otp"
				maxLength={length}
				caretHidden
			/>
		</Pressable>
	);
}

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		row: {
			flexDirection: "row",
			justifyContent: "space-between",
			gap: 8,
		},
		box: {
			flex: 1,
			aspectRatio: 0.85,
			maxHeight: 60,
			borderRadius: RADIUS.md,
			borderWidth: 1.5,
			borderColor: theme.border,
			backgroundColor: theme.background,
			alignItems: "center",
			justifyContent: "center",
		},
		boxActive: {
			borderColor: theme.accent,
		},
		digit: {
			fontFamily: "sans-extrabold",
			fontSize: 22,
			color: theme.primary,
		},
		digitPlaceholder: {
			color: theme.mutedForeground + "4D",
		},
		hiddenInput: {
			...StyleSheet.absoluteFill,
			opacity: 0,
		},
	});
