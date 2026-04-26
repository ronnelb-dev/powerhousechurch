-- AlterTable
ALTER TABLE "ChildAttendance"
ADD COLUMN "checkedInAt" TIMESTAMP(3),
ADD COLUMN "checkedOutAt" TIMESTAMP(3),
ADD COLUMN "checkedOutById" TEXT,
ADD COLUMN "pickupGuardianName" TEXT,
ADD COLUMN "pickupGuardianRelationship" TEXT,
ADD COLUMN "pickupNotes" TEXT;

-- CreateIndex
CREATE INDEX "ChildAttendance_checkedOutAt_idx" ON "ChildAttendance"("checkedOutAt");

-- AddForeignKey
ALTER TABLE "ChildAttendance"
ADD CONSTRAINT "ChildAttendance_checkedOutById_fkey"
FOREIGN KEY ("checkedOutById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
