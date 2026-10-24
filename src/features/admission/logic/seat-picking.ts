import { SeatMatrixSeat } from "@/features/seats/types/seats.types";

/** Seats shown per block in the picker; small libraries (this many or fewer) get one plain grid. */
export const SEAT_BLOCK_SIZE = 50;

export type SeatBlock = {
	key: string;
	/** "1–50", using the first and last seat numbers actually in the block. */
	label: string;
	seats: SeatMatrixSeat[];
};

/** Free in every one of these batches. */
export function isSeatFree(seat: SeatMatrixSeat, batchIds: number[]): boolean {
	return batchIds.every((bId) => seat.batches.find((sb) => sb.batch_id === bId)?.available === true);
}

/** The lowest-numbered seat free in all of these batches - the suggestion the form starts with. */
export function firstFreeSeat(seats: SeatMatrixSeat[], batchIds: number[]): SeatMatrixSeat | null {
	return seats.find((seat) => isSeatFree(seat, batchIds)) ?? null;
}

/** Seats in runs of SEAT_BLOCK_SIZE, so a 1,000-seat library is browsed 50 at a time. */
export function seatBlocks(seats: SeatMatrixSeat[]): SeatBlock[] {
	const blocks: SeatBlock[] = [];
	for (let i = 0; i < seats.length; i += SEAT_BLOCK_SIZE) {
		const slice = seats.slice(i, i + SEAT_BLOCK_SIZE);
		const label = `${slice[0].seat_number}–${slice[slice.length - 1].seat_number}`;
		blocks.push({ key: label, label, seats: slice });
	}
	return blocks;
}
