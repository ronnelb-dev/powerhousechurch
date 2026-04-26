CREATE TABLE "CareCase" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "memberId" TEXT,
    "prayerRequestId" TEXT,
    "assignedOwnerId" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "notes" TEXT,
    "nextAction" TEXT,
    "reminderAt" TIMESTAMP(3),
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CareCase_prayerRequestId_key" ON "CareCase"("prayerRequestId");
CREATE UNIQUE INDEX "CareCase_memberId_category_key" ON "CareCase"("memberId", "category");
CREATE INDEX "CareCase_category_isResolved_reminderAt_idx" ON "CareCase"("category", "isResolved", "reminderAt");
CREATE INDEX "CareCase_assignedOwnerId_reminderAt_idx" ON "CareCase"("assignedOwnerId", "reminderAt");
CREATE INDEX "CareCase_memberId_idx" ON "CareCase"("memberId");

ALTER TABLE "CareCase"
ADD CONSTRAINT "CareCase_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "CareCase"
ADD CONSTRAINT "CareCase_prayerRequestId_fkey"
FOREIGN KEY ("prayerRequestId") REFERENCES "PrayerRequest"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "CareCase"
ADD CONSTRAINT "CareCase_assignedOwnerId_fkey"
FOREIGN KEY ("assignedOwnerId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
