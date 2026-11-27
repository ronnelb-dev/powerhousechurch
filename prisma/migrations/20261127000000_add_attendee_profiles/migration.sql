-- Separate attendance roster people from portal login identities. Existing
-- accounts receive a linked attendee profile; unknown categories stay unset so
-- a church administrator can classify them manually.
CREATE TABLE "AttendeeProfile" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "category" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cellGroupId" TEXT,
    "linkedUserId" TEXT,
    "guardianProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendeeProfile_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AttendeeProfile" (
  "id", "firstName", "lastName", "phone", "isActive", "cellGroupId",
  "linkedUserId", "createdAt", "updatedAt"
)
SELECT 'attendee_' || "id", "firstName", "lastName", "phone", "isActive",
       "cellGroupId", "id", "createdAt", CURRENT_TIMESTAMP
FROM "User";

ALTER TABLE "Attendance" ADD COLUMN "attendeeProfileId" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "categorySnapshot" TEXT;
UPDATE "Attendance"
SET "attendeeProfileId" = 'attendee_' || "userId"
WHERE "userId" IS NOT NULL;
UPDATE "Attendance" AS attendance
SET "categorySnapshot" = profile."category"
FROM "AttendeeProfile" AS profile
WHERE attendance."attendeeProfileId" = profile."id";
ALTER TABLE "Attendance" ALTER COLUMN "attendeeProfileId" SET NOT NULL;

ALTER TABLE "Attendance" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_userId_fkey";
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_attendeeProfileId_fkey"
  FOREIGN KEY ("attendeeProfileId") REFERENCES "AttendeeProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttendeeProfile" ADD CONSTRAINT "AttendeeProfile_cellGroupId_fkey"
  FOREIGN KEY ("cellGroupId") REFERENCES "CellGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendeeProfile" ADD CONSTRAINT "AttendeeProfile_linkedUserId_fkey"
  FOREIGN KEY ("linkedUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendeeProfile" ADD CONSTRAINT "AttendeeProfile_guardianProfileId_fkey"
  FOREIGN KEY ("guardianProfileId") REFERENCES "AttendeeProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "AttendeeProfile_linkedUserId_key" ON "AttendeeProfile"("linkedUserId");
CREATE UNIQUE INDEX "Attendance_attendeeProfileId_type_date_key"
  ON "Attendance"("attendeeProfileId", "type", "date");
CREATE INDEX "AttendeeProfile_lastName_firstName_idx" ON "AttendeeProfile"("lastName", "firstName");
CREATE INDEX "AttendeeProfile_cellGroupId_isActive_idx" ON "AttendeeProfile"("cellGroupId", "isActive");
CREATE INDEX "AttendeeProfile_category_isActive_idx" ON "AttendeeProfile"("category", "isActive");
CREATE INDEX "AttendeeProfile_guardianProfileId_idx" ON "AttendeeProfile"("guardianProfileId");
