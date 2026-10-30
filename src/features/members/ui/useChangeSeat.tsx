import { useCallback, useRef, useState } from "react";

import { isSeatFree } from "@/features/admission/logic/seat-picking";
import { SeatPickerSheet } from "@/features/admission/ui/SeatPickerSheet";
import { changeSeatApi } from "@/features/members/logic/members.api";
import { getSeatMatrixApi } from "@/features/seats/logic/seats-api";
import { SeatMatrixSeat } from "@/features/seats/types/seats.types";
import { useActionSheet } from "@/shared/ui/ActionSheet";
import { showToast } from "@/shared/ui/Toast";

/** Who is moving, and from which seat in which batch. */
export type SeatChangeTarget = {
	memberId: number;
	memberName: string;
	batchId: number;
	batchName: string;
	seatId: number;
	seatNumber: number | string;
};

/**
 * "Change seat": loads the seat map, lets the owner pick a free seat in the same batch, confirms
 * the move, then saves it. Fee and renewal date stay as they are. Render `element` once in the screen.
 */
export function useChangeSeat(onChanged: () => void) {
	const actionSheet = useActionSheet();
	const [target, setTarget] = useState<SeatChangeTarget | null>(null);
	const [seats, setSeats] = useState<SeatMatrixSeat[]>([]);
	const [pickerVisible, setPickerVisible] = useState(false);
	// The batch whose seats are loading, so only that row's button shows a spinner.
	const [loadingBatchId, setLoadingBatchId] = useState<number | null>(null);
	// The seat picked, confirmed once the picker has slid away (so the confirm sheet doesn't stack on it).
	const pending = useRef<SeatMatrixSeat | null>(null);

	const start = useCallback(async (next: SeatChangeTarget) => {
		setTarget(next);
		try {
			setLoadingBatchId(next.batchId);
			const response = await getSeatMatrixApi();
			const all = response.data.seats;
			if (!all.some((seat) => isSeatFree(seat, [next.batchId]))) {
				showToast({ message: `No free seat in ${next.batchName}`, detail: "Every seat in this batch is taken.", tone: "info" });
				return;
			}
			setSeats(all);
			setPickerVisible(true);
		} catch (err: any) {
			showToast({ message: "Couldn't load seats", detail: err.message, tone: "error" });
		} finally {
			setLoadingBatchId(null);
		}
	}, []);

	const save = useCallback(
		async (to: SeatMatrixSeat) => {
			if (!target) return;
			try {
				await changeSeatApi(target.memberId, target.batchId, to.seat_id);
				showToast({ message: `Moved to seat ${to.seat_number}`, detail: `${target.memberName} · ${target.batchName}` });
				onChanged();
			} catch (err: any) {
				showToast({ message: "Couldn't change the seat", detail: err.message, tone: "error" });
			}
		},
		[target, onChanged]
	);

	const confirm = useCallback(() => {
		const to = pending.current;
		pending.current = null;
		if (!to || !target) return;
		actionSheet.open({
			title: `Move to seat ${to.seat_number}?`,
			message: `${target.memberName} moves from seat ${target.seatNumber} to seat ${to.seat_number} in ${target.batchName}. Their fee and renewal date stay the same.`,
			confirm: true,
			actions: [{ label: `Move to seat ${to.seat_number}`, icon: "swap-horizontal", tone: "primary", onPress: () => void save(to) }],
		});
	}, [actionSheet, target, save]);

	const isFree = useCallback((seat: SeatMatrixSeat) => (target ? isSeatFree(seat, [target.batchId]) : false), [target]);

	const element = (
		<>
			<SeatPickerSheet
				visible={pickerVisible}
				title={target ? `New seat in ${target.batchName}` : "New seat"}
				seats={seats}
				isFree={isFree}
				selectedSeatId={target?.seatId ?? null}
				onPick={(seatId) => {
					const seat = seats.find((s) => s.seat_id === seatId);
					// Tapping their current seat just closes the picker.
					if (seat && isFree(seat)) pending.current = seat;
					setPickerVisible(false);
				}}
				onClose={() => setPickerVisible(false)}
				onClosed={confirm}
			/>
			{actionSheet.sheet}
		</>
	);

	return { start, loadingBatchId, element };
}
