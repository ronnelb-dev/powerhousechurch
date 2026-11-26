-- Retire Kids Ministry records and its generic serving interest entry.
DELETE FROM "ServingInterest"
WHERE "ministryId" IN (
  SELECT "id" FROM "Ministry" WHERE "name" = 'Kids Ministry'
);

DELETE FROM "Ministry" WHERE "name" = 'Kids Ministry';

-- Communications has no dedicated table; remove only its send audit entries.
DELETE FROM "AdminAuditLog" WHERE "action" = 'communications.send';

-- Drop module-specific records and relations.
DROP TABLE "ChildAttendance";
DROP TABLE "ChildGuardian";
DROP TABLE "ChildProfile";
DROP TABLE "SermonBookmark";
DROP TABLE "Sermon";

ALTER TABLE "NotificationPreference" DROP COLUMN "sermonAnnouncements";
