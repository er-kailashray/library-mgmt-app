import { Ionicons } from "@expo/vector-icons";

export type Amenity = "ac" | "wifi" | "water" | "power_backup" | "parking" | "cctv" | "washroom" | "locker";

export const AMENITY_LABELS: Record<Amenity, string> = {
    ac: "AC",
    wifi: "Wi-Fi",
    water: "Drinking Water",
    power_backup: "Power Backup",
    parking: "Parking",
    cctv: "CCTV",
    washroom: "Washroom",
    locker: "Locker",
};

export const AMENITY_ICONS: Record<Amenity, keyof typeof Ionicons.glyphMap> = {
    ac: "snow-outline",
    wifi: "wifi-outline",
    water: "water-outline",
    power_backup: "flash-outline",
    parking: "car-outline",
    cctv: "videocam-outline",
    washroom: "home-outline",
    locker: "lock-closed-outline",
};

export const AMENITY_OPTIONS: Amenity[] = Object.keys(AMENITY_LABELS) as Amenity[];

export interface LibraryPhoto {
    id: number;
    url: string;
}

export interface LibraryProfile {
    id: number;
    library_name: string;
    total_seats: number;
    amenities: Amenity[];
    photos: LibraryPhoto[];
    address: string | null;
    latitude: number | null;
    longitude: number | null;
}

export interface LibraryLocation {
    address: string;
    latitude: number;
    longitude: number;
}

export interface LibraryProfileResponse {
    status: boolean;
    message?: string;
    data: LibraryProfile;
}
