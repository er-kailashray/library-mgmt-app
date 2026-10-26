import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, View } from "react-native";

import { firstName, formatHeaderDate, greetingFor } from "@/features/home/logic/home-format";
import type { Theme } from "@/shared/constants/theme";
import { scale, ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";
import { getInitials } from "@/shared/utils/text";

type Props = {
	libraryName?: string | null;
	libraryAddress?: string | null;
	ownerName?: string | null;
	ownerPhoto?: string | null;
	onPressLocation: () => void;
	onPressProfile: () => void;
};

/**
 * Today's date, a greeting by name, and which library this is (tap to set its location).
 * The avatar opens Settings.
 */
export function HomeHeader({ libraryName, libraryAddress, ownerName, ownerPhoto, onPressLocation, onPressProfile }: Props) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const now = new Date();
	const name = firstName(ownerName);

	return (
		<View style={styles.header}>
			<View style={styles.text}>
				<Text style={styles.date}>{formatHeaderDate(now)}</Text>
				<Text style={styles.greeting} numberOfLines={1}>
					{greetingFor(now)}
					{name ? `, ${name}` : ""}
				</Text>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={libraryAddress ? `${libraryName}, ${libraryAddress}` : "Add library location"}
					style={({ pressed }) => [styles.libraryRow, pressed && styles.pressed]}
					onPress={onPressLocation}
					hitSlop={6}>
					<Ionicons name="location" size={13} color={theme.accent} />
					<Text style={styles.libraryName} numberOfLines={1}>
						{libraryName || "My Library"}
					</Text>
					{libraryAddress ? (
						<Text style={styles.libraryAddress} numberOfLines={1}>
							· {libraryAddress}
						</Text>
					) : (
						<Text style={styles.addLocation}>· Add location</Text>
					)}
				</Pressable>
			</View>

			<Pressable accessibilityRole="button" accessibilityLabel="Profile and settings" onPress={onPressProfile} style={({ pressed }) => pressed && styles.pressed}>
				<View style={styles.avatarRing}>
					{ownerPhoto ? (
						<Image source={{ uri: ownerPhoto }} style={styles.avatar} transition={150} />
					) : (
						<View style={styles.avatar}>
							<Text style={styles.avatarText}>{getInitials(ownerName || "")}</Text>
						</View>
					)}
				</View>
			</Pressable>
		</View>
	);
}

const AVATAR = scale(44);

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		header: {
			flexDirection: "row",
			alignItems: "center",
			paddingHorizontal: 20,
			paddingTop: 8,
			paddingBottom: 12,
			gap: 16,
		},
		text: {
			flex: 1,
		},
		date: {
			fontFamily: "sans-bold",
			fontSize: 11,
			letterSpacing: 1,
			color: theme.accent,
		},
		greeting: {
			fontFamily: "sans-extrabold",
			fontSize: 24,
			letterSpacing: -0.5,
			color: theme.primary,
			marginTop: 2,
		},
		libraryRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 4,
			marginTop: 4,
		},
		libraryName: {
			flexShrink: 0,
			maxWidth: "60%",
			fontFamily: "sans-semibold",
			fontSize: 13,
			color: theme.primary,
		},
		libraryAddress: {
			flexShrink: 1,
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
		},
		addLocation: {
			fontFamily: "sans-semibold",
			fontSize: 13,
			color: theme.accent,
		},
		// A thin coral ring around the photo, so it reads as "you".
		avatarRing: {
			padding: 2,
			borderRadius: AVATAR / 2 + 3,
			borderWidth: 1.5,
			borderColor: theme.accent + "66",
		},
		avatar: {
			width: AVATAR,
			height: AVATAR,
			borderRadius: AVATAR / 2,
			backgroundColor: theme.muted,
			alignItems: "center",
			justifyContent: "center",
			overflow: "hidden",
		},
		avatarText: {
			fontFamily: "sans-bold",
			fontSize: 16,
			color: theme.primary,
		},
		pressed: {
			opacity: 0.7,
		},
	});
