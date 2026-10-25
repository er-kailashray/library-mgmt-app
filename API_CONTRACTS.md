# API contract notes

Living notes on the backend contract the mobile app depends on. Update this when an endpoint's
shape changes or a new one is added — it's the fastest way for either side to see what the other
expects without reading both codebases.

All endpoints below require `Authorization: Bearer <token>` and respond with the envelope
`{ "status": boolean, "message"?: string, "data"?: ... }`.

## Implemented

- `GET /api/members`, `GET /api/members/{id}`, `POST /api/members/{id}/deactivate`
- `GET /api/batches`, `POST /api/batches`
- `GET /api/seat-matrix`
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
