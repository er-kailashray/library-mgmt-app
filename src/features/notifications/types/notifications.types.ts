export type OwnerNotificationType = "renewals_due" | "dues_summary" | "subscription";

export interface OwnerNotification {
    id: number;
    /** Unknown types (added later on the backend) fall back to a generic look. */
    type: OwnerNotificationType | string;
    title: string;
    body: string;
    /** App route opened on tap, e.g. "/payments". */
    url: string | null;
    read: boolean;
    created_at: string;
}

export interface NotificationsPage {
    items: OwnerNotification[];
    has_more: boolean;
    unread_count: number;
}

export interface NotificationsResponse {
    status: boolean;
    data: NotificationsPage;
}

export interface UnreadCountResponse {
    status: boolean;
    data: { unread_count: number };
}
