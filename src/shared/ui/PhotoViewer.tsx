import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, type ReactNode } from "react";
import { FlatList, Image, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface ViewerPhoto {
	key: string;
	uri: string;
}

interface PhotoViewerProps {
	visible: boolean;
	photos: ViewerPhoto[];
	/** Which photo to open on. */
	initialIndex?: number;
	onClose: () => void;
	/** Actions under the photo, e.g. a "Change photo" button. Gets the photo being shown. */
	renderFooter?: (index: number) => ReactNode;
}

/**
 * Full-screen photo preview on a dark backdrop. With several photos, swipe sideways between
 * them; a counter shows where you are. Closes with the X or the system back gesture.
 */
export function PhotoViewer({ visible, photos, initialIndex = 0, onClose, renderFooter }: PhotoViewerProps) {
	const { width, height } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const [index, setIndex] = useState(initialIndex);

	// Each opening starts on the photo that was tapped.
	useEffect(() => {
		if (visible) setIndex(initialIndex);
	}, [visible, initialIndex]);

	const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
	};

	return (
		<Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
			<View style={styles.backdrop}>
				<FlatList
					data={photos}
					keyExtractor={(photo) => photo.key}
					horizontal
					pagingEnabled
					showsHorizontalScrollIndicator={false}
					initialScrollIndex={Math.min(initialIndex, Math.max(photos.length - 1, 0))}
					getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
					onMomentumScrollEnd={onScrollEnd}
					renderItem={({ item }) => (
						<View style={[styles.page, { width, height }]}>
							<Image source={{ uri: item.uri }} style={{ width, height: height * 0.75 }} resizeMode="contain" accessibilityIgnoresInvertColors />
						</View>
					)}
				/>

				<View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
					<Text style={styles.counter}>{photos.length > 1 ? `${index + 1} / ${photos.length}` : ""}</Text>
					<Pressable accessibilityRole="button" accessibilityLabel="Close photo" style={styles.closeBtn} onPress={onClose} hitSlop={8}>
						<Ionicons name="close" size={24} color="#fff" />
					</Pressable>
				</View>

				{renderFooter && <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>{renderFooter(index)}</View>}
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.94)",
	},
	page: {
		alignItems: "center",
		justifyContent: "center",
	},
	topBar: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 20,
	},
	counter: {
		fontFamily: "sans-semibold",
		fontSize: 14,
		color: "#fff",
	},
	closeBtn: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "rgba(255,255,255,0.15)",
		alignItems: "center",
		justifyContent: "center",
	},
	footer: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		alignItems: "center",
		paddingHorizontal: 20,
	},
});
