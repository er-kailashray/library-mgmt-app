import { Ionicons } from "@expo/vector-icons";
import { useCallback, useRef, useState, type ReactElement } from "react";
import { Pressable, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { Text } from "@/shared/ui/Text";
import { haptics } from "@/shared/utils/haptics";

export type ActionSheetAction = {
	label: string;
	/** Smaller line under the label, e.g. what the action will do. */
	hint?: string;
	icon?: keyof typeof Ionicons.glyphMap;
	/** "destructive" is red (delete, undo, log out); "primary" is the coral main choice. */
	tone?: "default" | "primary" | "destructive";
	onPress: () => void;
};

type Props = {
	visible: boolean;
	onClose: () => void;
	title: string;
	message?: string;
	actions: ActionSheetAction[];
	/** Shown as a separate button under the actions. */
	cancelLabel?: string;
	/**
	 * Confirmation style: the actions show as full-width buttons (e.g. "Delete batch") instead of a
	 * list of rows. Use for "Are you sure?" questions with one or two answers.
	 */
	confirm?: boolean;
};

/**
 * The app's replacement for multi-button Alert.alert: a bottom sheet with every option (Android's
 * system alert shows at most three buttons and drops the rest) plus a clear Cancel, and swipe-down
 * to dismiss. The chosen action runs once the sheet has slid away, so it can open another sheet.
 *
 * Render it next to the thing that opens it; inside another BottomSheet, render it within that
 * sheet's content so it opens on top.
 */
export function ActionSheet({ visible, onClose, title, message, actions, cancelLabel = "Cancel", confirm = false }: Props) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	// The tapped action waits here until the sheet is fully closed.
	const pending = useRef<(() => void) | null>(null);

	const choose = (action: ActionSheetAction) => {
		if (action.tone === "destructive") haptics.warning();
		else haptics.selection();
		pending.current = action.onPress;
		onClose();
	};

	const colorFor = (tone: ActionSheetAction["tone"]) => (tone === "destructive" ? theme.destructive : tone === "primary" ? theme.accent : theme.primary);

	return (
		<BottomSheet
			visible={visible}
			onClose={onClose}
			onClosed={() => {
				const run = pending.current;
				pending.current = null;
				run?.();
			}}
			title={title}
			subtitle={message}>
			{actions.length === 0 ? null : confirm ? (
				<View style={styles.confirmList}>
					{actions.map((action) => {
						const destructive = action.tone === "destructive";
						return (
							<Pressable
								key={action.label}
								accessibilityRole="button"
								style={({ pressed }) => [styles.confirmBtn, destructive ? styles.confirmBtnDestructive : styles.confirmBtnPrimary, pressed && styles.pressed]}
								onPress={() => choose(action)}>
								{action.icon && <Ionicons name={action.icon} size={18} color="#fff" />}
								<Text style={styles.confirmText}>{action.label}</Text>
							</Pressable>
						);
					})}
				</View>
			) : (
				<View style={styles.list}>
					{actions.map((action, index) => {
						const color = colorFor(action.tone);
						return (
							<Pressable
								key={action.label}
								accessibilityRole="button"
								accessibilityHint={action.hint}
								style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && styles.rowPressed]}
								onPress={() => choose(action)}>
								{action.icon && (
									<View style={[styles.iconTile, { backgroundColor: color + "14" }]}>
										<Ionicons name={action.icon} size={19} color={color} />
									</View>
								)}
								<View style={styles.rowText}>
									<Text style={[styles.rowLabel, { color }]}>{action.label}</Text>
									{action.hint ? <Text style={styles.rowHint}>{action.hint}</Text> : null}
								</View>
								<Ionicons name="chevron-forward" size={16} color={theme.mutedForeground + "99"} />
							</Pressable>
						);
					})}
				</View>
			)}

			<Pressable accessibilityRole="button" style={({ pressed }) => [styles.cancelBtn, pressed && styles.rowPressed]} onPress={onClose}>
				<Text style={styles.cancelText}>{cancelLabel}</Text>
			</Pressable>
		</BottomSheet>
	);
}

export type ActionSheetOptions = Omit<Props, "visible" | "onClose">;

/**
 * The usual way to use ActionSheet: `open({ title, actions })` from a tap, and render `sheet`
 * somewhere in the screen (inside a BottomSheet's content when opened from one). Keeps the last
 * options while the sheet slides away, so it doesn't go blank on the way out.
 */
export function useActionSheet(): { open: (options: ActionSheetOptions) => void; sheet: ReactElement | null } {
	const [options, setOptions] = useState<ActionSheetOptions | null>(null);
	const [visible, setVisible] = useState(false);
	const open = useCallback((next: ActionSheetOptions) => {
		setOptions(next);
		setVisible(true);
	}, []);
	const sheet = options ? <ActionSheet {...options} visible={visible} onClose={() => setVisible(false)} /> : null;
	return { open, sheet };
}

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		list: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.lg,
			borderWidth: 1,
			borderColor: theme.border,
			overflow: "hidden",
			marginTop: 6,
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingHorizontal: 14,
			paddingVertical: 13,
			minHeight: 56,
		},
		rowDivider: {
			borderTopWidth: 1,
			borderTopColor: theme.border,
		},
		rowPressed: {
			backgroundColor: theme.muted,
		},
		iconTile: {
			width: 34,
			height: 34,
			borderRadius: RADIUS.sm,
			alignItems: "center",
			justifyContent: "center",
		},
		rowText: {
			flex: 1,
		},
		rowLabel: {
			fontFamily: "sans-semibold",
			fontSize: 15,
		},
		rowHint: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 1,
		},
		confirmList: {
			gap: 10,
			marginTop: 10,
		},
		confirmBtn: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: 8,
			paddingVertical: 15,
			borderRadius: RADIUS.md,
		},
		confirmBtnPrimary: {
			backgroundColor: theme.accent,
		},
		confirmBtnDestructive: {
			backgroundColor: theme.destructive,
		},
		confirmText: {
			...BUTTON_TEXT,
			color: "#fff",
		},
		cancelBtn: {
			alignItems: "center",
			justifyContent: "center",
			marginTop: 10,
			paddingVertical: 14,
			borderRadius: RADIUS.md,
			backgroundColor: theme.card,
			borderWidth: 1,
			borderColor: theme.border,
		},
		cancelText: {
			fontFamily: "sans-semibold",
			fontSize: 15,
			color: theme.primary,
		},
		pressed: {
			opacity: 0.85,
		},
	});
