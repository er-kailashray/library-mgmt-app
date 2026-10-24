import { Ionicons } from "@expo/vector-icons";

export type Amenity =
    | "ac"
    | "cooler"
    | "desk_lamp"
    | "water"
    | "washroom"
    | "silent_zone"
    | "wifi"
    | "charging"
    | "newspaper"
    | "magazines"
    | "books"
    | "printing"
    | "cctv"
    | "power_backup"
    | "locker"
    | "parking"
    | "refreshments"
    | "first_aid";

export const AMENITY_LABELS: Record<Amenity, string> = {
    ac: "AC",
    cooler: "Cooler",
    desk_lamp: "Desk Lamp",
    water: "Drinking Water",
    washroom: "Washroom",
    silent_zone: "Silent Zone",
    wifi: "Wi-Fi",
    charging: "Charging Points",
    newspaper: "Newspaper",
    magazines: "Magazines",
    books: "Books",
    printing: "Print & Xerox",
    cctv: "CCTV",
    power_backup: "Power Backup",
    locker: "Locker",
    parking: "Parking",
    refreshments: "Tea / Coffee",
    first_aid: "First Aid",
};

export const AMENITY_ICONS: Record<Amenity, keyof typeof Ionicons.glyphMap> = {
    ac: "snow-outline",
    cooler: "thermometer-outline",
    desk_lamp: "bulb-outline",
    water: "water-outline",
    washroom: "male-female-outline",
    silent_zone: "volume-mute-outline",
    wifi: "wifi-outline",
    charging: "battery-charging-outline",
    newspaper: "newspaper-outline",
    magazines: "reader-outline",
    books: "book-outline",
    printing: "print-outline",
    cctv: "videocam-outline",
    power_backup: "flash-outline",
    locker: "lock-closed-outline",
    parking: "car-outline",
    refreshments: "cafe-outline",
    first_aid: "medkit-outline",
};

/** Shown in these groups, in this order, so the list stays easy to scan as it grows. */
export const AMENITY_GROUPS: { title: string; amenities: Amenity[] }[] = [
    { title: "Comfort", amenities: ["ac", "cooler", "desk_lamp", "water", "washroom", "silent_zone"] },
    { title: "Study", amenities: ["wifi", "charging", "newspaper", "magazines", "books", "printing"] },
    { title: "Safety & Facilities", amenities: ["cctv", "power_backup", "locker", "parking", "refreshments", "first_aid"] },
];

export const AMENITY_OPTIONS: Amenity[] = AMENITY_GROUPS.flatMap((group) => group.amenities);

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
