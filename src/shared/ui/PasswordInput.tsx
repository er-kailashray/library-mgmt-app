import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, TextInputProps, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { TextInput } from "@/shared/ui/Text";

type PasswordInputProps = Omit<TextInputProps, "secureTextEntry"> & {
	hasError?: boolean;
};

/** Text input with a show/hide eye toggle, styled like the auth form fields. */
export function PasswordInput({ hasError = false, style, ...props }: PasswordInputProps) {
	const { theme } = useTheme();
	const [isVisible, setIsVisible] = useState(false);
	const styles = createStyles(theme);

	return (
		<View>
			<TextInput
				style={[styles.input, hasError && styles.inputError, style]}
				placeholderTextColor={theme.mutedForeground + "80"}
				autoCapitalize="none"
				autoCorrect={false}
				secureTextEntry={!isVisible}
				{...props}
			/>
			<Pressable
				style={styles.eyeButton}
				onPress={() => setIsVisible((v) => !v)}
				accessibilityRole="button"
				accessibilityLabel={isVisible ? "Hide password" : "Show password"}
			>
				<Ionicons name={isVisible ? "eye-off" : "eye"} size={20} color={theme.mutedForeground} />
			</Pressable>
		</View>
	);
}

const createStyles = (theme: Theme) =>
	StyleSheet.create({
		input: {
			fontFamily: "sans-medium",
			borderRadius: RADIUS.md,
			borderWidth: 1.5,
			borderColor: theme.border,
			backgroundColor: theme.background,
			paddingLeft: 16,
			paddingRight: 52,
			paddingVertical: 14,
			fontSize: 15,
			color: theme.primary,
		},
		inputError: {
			borderColor: theme.destructive,
		},
		eyeButton: {
			position: "absolute",
			right: 4,
			top: 0,
			bottom: 0,
			justifyContent: "center",
			alignItems: "center",
			width: 44,
		},
	});
