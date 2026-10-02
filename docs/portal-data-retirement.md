# Portal Data Retirement Plan

This document describes a future destructive database change. The portal-removal application change does not execute this plan, create a drop migration, or delete production data.

## Approval gates

Before scheduling the migration:

1. Confirm the portal-removal release has been deployed and that `/portal/*` and `/auth/*` return 404.
2. Observe public RSVP, prayer request, visit-plan, cell-group, sermon, gallery, giving, and settings-backed pages for at least one normal deployment window.
3. Obtain written approval for the retention period and archival destination for member, attendance, children, community, care, email-queue, and audit data.
4. Take a restorable database snapshot and export every table listed below in a documented, access-controlled format.
5. Record table row counts and checksums before the maintenance window. Test restoration into a disposable database.

## Data eligible for archival and removal

Portal-only tables:

- `User`, `Session`, `EmailVerificationToken`, and `PasswordResetToken`
- `Attendance`, `AttendanceSession`, `AttendanceRosterEntry`, and `AttendanceChange`
- `ChildProfile`, `ChildGuardian`, and `ChildAttendance`
- `Post`, `Like`, and `Comment`
- `SermonBookmark`, `ServingInterest`, and `NotificationPreference`
- `CareCase`, `OutboundEmail`, and `AdminAuditLog`

Portal-only columns on retained public tables:

- `EventRegistration.checkedInAt` and `EventRegistration.checkedInById`
- `PrayerRequest.memberId`, `status`, `followUpOwnerId`, `isAnswered`, and `answeredAt`
- `VisitPlan.status`, `followUpOwnerId`, `lastContactedAt`, `nextFollowUpAt`, and `outcomeNotes`
- `CellGroup.leaderId` after confirming no external workflow relies on it

Retain the `CellGroup`, `Sermon`, `Event`, `EventRegistration`, `Ministry`, `BlogPost`, `PrayerRequest`, `VisitPlan`, `GivingRecord`, and `Setting` tables and all public submission rows.

## Migration sequence

Create one new forward-only Prisma migration after approval. Do not alter or delete historical migration files.

Within a maintenance window and transaction where PostgreSQL permits:

1. Stop public writes and verify the application version no longer accesses portal tables.
2. Drop foreign keys from retained tables to `User`, including prayer-request and visit-plan ownership constraints.
3. Drop dependent portal tables before their parents: likes/comments before posts; attendance changes and roster entries before attendance sessions; child attendance/guardians before child profiles; sessions/tokens and all remaining user-dependent tables before users.
4. Drop the portal-only columns from retained tables.
5. Drop `AttendanceType`, `AttendanceStatus`, and `AttendanceSessionState` after all attendance tables are gone.
6. Re-run Prisma schema validation and compare the deployed database with `prisma/schema.prisma`.
7. Restore public writes only after the post-migration checks pass.

The migration must be reviewed from generated SQL before deployment. It must not contain drops for any retained public table or public submission column.

## Verification and rollback

After migration, verify:

- Portal table and enum names are absent from the catalog.
- Retained table row counts match their pre-migration counts.
- Public sermons, events, ministries, blog posts, cell groups, settings, and gallery still load.
- New guest RSVPs, prayer requests, and visit plans persist successfully.
- Giving and calendar-download routes still work.
- Application logs contain no missing-table or missing-column errors.

If any check fails, stop writes and restore the pre-migration snapshot. Because the migration destroys archived data, rollback is restore-based rather than a reverse SQL migration.
