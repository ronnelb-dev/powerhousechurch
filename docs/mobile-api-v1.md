# Mobile API v1

The portal and future mobile client share attendee and attendance records. The
web portal uses Lucia session cookies; mobile clients use the same Lucia
session as an opaque bearer token. Send `Authorization: Bearer <token>` and
`Content-Type: application/json` on authenticated requests. Tokens expire with
the Lucia session and can be revoked with logout.

## Sign in and out

`POST /api/v1/auth/login` accepts a username, email address, or phone number
in `identifier`:

```json
{ "identifier": "rbarashari", "password": "..." }
```

Returns `{ "token", "tokenType": "Bearer", "expiresAt", "user": { "id", "firstName", "lastName", "role" } }`.

`POST /api/v1/auth/logout` revokes the current session and returns `204`.

## Attendee profiles

`GET /api/v1/attendees` returns active roster profiles with identity, category,
cell group, guardian, and update time. Admins and ushers can read the full
roster. Cell leaders receive only their assigned cell group. Members receive
`403`.

`POST /api/v1/attendees` (admin or usher) creates a roster profile. For an
Adult or Young Professional, include an email to create an `ATTENDEE` login
and send a one-time account setup link. Kids remain roster-only. Without an
email, the profile has no login:

```json
{
  "firstName": "Mika",
  "lastName": "Reyes",
  "category": "KIDS",
  "email": null,
  "cellGroupId": "optional-cell-group-id",
  "guardianProfileId": "optional-guardian-profile-id"
}
```

`PATCH /api/v1/attendees` (admin only) accepts `id` and any of `category`,
`cellGroupId`, `guardianProfileId`, `linkedUserId`, or `isActive`. Categories are `ADULT`,
`YOUNG_PROFESSIONAL`, and `KIDS`. A missing legacy category remains `null`
until an administrator assigns it.

## Attendance

`GET /api/v1/attendance?date=YYYY-MM-DD&type=SUNDAY_SERVICE` returns profiles
and their status and category-at-the-time for that date. `type` may be `SUNDAY_SERVICE` or `CELL_GROUP`.
Cell leaders see only their group; admins and ushers see the full active
roster.

`POST /api/v1/attendance` marks one or more attendees present/absent, or clears
their mark by sending `status: null`:

```json
{
  "attendeeProfileIds": ["profile-id"],
  "date": "2026-11-27",
  "type": "SUNDAY_SERVICE",
  "status": "PRESENT"
}
```

Attendance writes are idempotent per attendee, type, and date. The category is
snapshotted when a mark is saved so later profile edits do not rewrite history.
Future dates,
duplicate IDs, unavailable profiles, and out-of-group cell leader updates are
rejected. The API returns JSON errors with `400`, `401`, `403`, or `404` status
codes as appropriate.
