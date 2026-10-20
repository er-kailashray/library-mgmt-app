export interface AdmissionAllocation {
    batch_id: number;
    seat_id: number;
}

export type IdProofType = "aadhaar" | "pan" | "voter_id_dl" | "student_id" | "other";

export type IdProofSide = "front" | "back";

export const ID_PROOF_TYPE_LABELS: Record<IdProofType, string> = {
    aadhaar: "Aadhaar Card",
    pan: "PAN Card",
    voter_id_dl: "Voter ID / Driving License",
    student_id: "Student / College ID",
    other: "Other",
};

export const ID_PROOF_TYPE_OPTIONS: { value: IdProofType; label: string }[] = (Object.keys(ID_PROOF_TYPE_LABELS) as IdProofType[]).map((value) => ({
    value,
    label: ID_PROOF_TYPE_LABELS[value],
}));

export interface CreateAdmissionRequest {
    name: string;
    phone: string;
    allocations: AdmissionAllocation[];
}

export interface CreateAdmissionResult {
    memberId: number;
}
