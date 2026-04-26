-- Add workflow fields for prayer-request triage and answered archive support.
ALTER TABLE "PrayerRequest"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'NEW',
ADD COLUMN "followUpOwnerId" TEXT,
ADD COLUMN "answeredAt" TIMESTAMP(3);

ALTER TABLE "PrayerRequest"
ADD CONSTRAINT "PrayerRequest_followUpOwnerId_fkey"
FOREIGN KEY ("followUpOwnerId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "PrayerRequest_status_submittedAt_idx"
ON "PrayerRequest"("status", "submittedAt");

CREATE INDEX "PrayerRequest_followUpOwnerId_idx"
ON "PrayerRequest"("followUpOwnerId");
