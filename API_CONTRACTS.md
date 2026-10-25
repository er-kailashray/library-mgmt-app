# API contract notes

Living notes on the backend contract the mobile app depends on. Update this when an endpoint's
shape changes or a new one is added — it's the fastest way for either side to see what the other
expects without reading both codebases.

All endpoints below require `Authorization: Bearer <token>` and respond with the envelope
`{ "status": boolean, "message"?: string, "data"?: ... }`.

## Implemented

- `GET /api/members`, `GET /api/members/{id}`, `POST /api/members/{id}/deactivate`. Each list row
  carries `seats[]` `{ batch_id, batch_name, start_time, end_time, seat_number }` — where the member
  sits now, one per active batch in the day's order (empty for members who left).
- `GET /api/batches`, `POST /api/batches`
- `GET /api/seat-matrix` — every seat with, per batch, `available` and `occupant` (`null` when free,
  else `{ member_id, name, renewal_date, is_due }`; `is_due` once the renewal date is reached).
  The Seats map uses it to show who sits where; Admission only reads `available`. Admission also
  accepts `?batch_id=&seat_id=` to open with that batch and seat chosen ("Admit" on a free seat).
- `POST /api/admission`
- `GET /api/payments`, `POST /api/payments`
- `GET /api/dashboard`
- `GET /api/attendance` (optional `?date=YYYY-MM-DD`, defaults to today), `POST /api/attendance`
- `POST /api/members/{id}/remind` — SMS reminder to one member (via the existing Twilio SMS
  provider in `app/Notifications`)
- `POST /api/reminders/overdue` — SMS reminder to every currently overdue member in the library;
  partial failures don't abort the batch, response includes `{ sent, failed, failed_members }`
- `GET /api/renewals/upcoming` — members whose allocation renews within the configured window
  (`config('library.dues.upcoming_renewal_window_days')`, 7 by default) but isn't overdue yet;
  `POST /api/renewals/upcoming/remind` sends an SMS to all of them (same `{sent, failed,
  failed_members}` shape as the overdue bulk endpoint)
- `POST /api/forgot-password` `{ phone }` — sends a `forgot_password` OTP (30 s cooldown, 429 with
  `retry_after`); `POST /api/reset-password` `{ phone, otp, password, password_confirmation }` —
  sets the new password and revokes every token
- `POST /api/me/password` `{ current_password, password, password_confirmation }` — change password
  while signed in; 422 on a wrong current password; other devices' tokens are revoked
- `POST /api/me/push-tokens` `{ token, platform? }` — register this device's Expo push token
  (`ExponentPushToken[...]`); a token already on another account moves to the caller.
  `POST /api/me/push-tokens/remove` `{ token }` on logout. `POST /api/me/notification-settings`
  `{ enabled }` — the owner's single on/off switch, returned as `push_notifications_enabled` on `/me`.
  Notifications carry `data.url` (an app route such as `/payments`) that the app opens on tap.
- `GET /api/notifications` (optional `?before=<id>` for the next page) — the Alerts inbox, newest
  first, 30 per page: `{ items: [{ id, type, title, body, url, read, created_at }], has_more,
  unread_count }`. `type` is `renewals_due` / `dues_summary` / `subscription`. The morning alerts
  and plan reminders are saved here even when push is off or no device is registered; the
  "batch starts in 5 minutes" nudge is push-only. `GET /api/notifications/unread-count` →
  `{ unread_count }` for the tab badge. `POST /api/notifications/read` `{ ids? }` marks those read
  (all when `ids` is left out) and returns the new `unread_count`. Not subject to the library or
  subscription checks.
- `GET /api/reports?months=3|6|12` (default 6) — `{ months, from, to, revenue, dues, members,
  attendance }`. `revenue.by_month[]` `{ month: "YYYY-MM", label, collected (net of refunds),
  refunded, payments_count }`, plus `total`, `this_month`, `last_month`, `change_pct` (null when last
  month is 0) and `by_mode[]`. `dues` `{ total_outstanding, overdue_members, by_age[] { key, label,
  members, amount }, collection_rate }` (collected this month ÷ (collected + still owed), %, null
  when both are 0). `members` `{ active, by_month[] { joined, left, active }, occupancy[] per batch
  { occupied, total, rate } }`. `attendance` `{ window_days: 30, tracked, by_batch[] { enrolled,
  marked_days, average_present, rate }, not_seen { after_days: 7, count, members[] { member_id, name,
  last_seen | null, days } } }`.

`POST /api/members/{id}/remind` is channel-smart: it sends the overdue message if the member owes
money, the renewal message if they don't but are renewing soon, otherwise a generic nudge — same
logic `ReminderService::remindMember` shares with both bulk endpoints.

WhatsApp reminders are **not** a backend call — the mobile app opens a `wa.me` deep link directly
(`src/shared/utils/whatsapp.ts`) so the owner sends it themselves from their own WhatsApp, no
Business API or template approval needed. SMS is the only server-triggered channel right now.

Response shapes are defined in each feature's `src/features/*/types/*.types.ts` on the mobile
side, and mirrored by feature tests in `tests/Feature/*ApiTest.php` on the backend side — those
are the source of truth, not this file. Treat a mismatch between them as a bug.

## Known gaps (not yet built)

- **No endpoint to edit `Library.total_seats` or batch fee/time after creation.** An owner adding
  physical desks, or changing a batch's price, currently has no way to reflect that — `Batch` only
  has `index`/`store`, no `update`/`destroy`.
- **No payment-history-by-member endpoint.** `MemberDetailScreen` shows current batch/seat
  allocations but not past payments for that member.
