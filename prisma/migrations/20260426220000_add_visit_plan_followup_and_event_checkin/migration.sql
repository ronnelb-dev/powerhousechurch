ALTER TABLE "VisitPlan"
ADD COLUMN "followUpOwnerId" TEXT,
ADD COLUMN "lastContactedAt" TIMESTAMP(3),
ADD COLUMN "nextFollowUpAt" TIMESTAMP(3),
ADD COLUMN "outcomeNotes" TEXT;

ALTER TABLE "VisitPlan"
ADD CONSTRAINT "VisitPlan_followUpOwnerId_fkey"
FOREIGN KEY ("followUpOwnerId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "VisitPlan_followUpOwnerId_idx"
ON "VisitPlan"("followUpOwnerId");

CREATE INDEX "VisitPlan_nextFollowUpAt_idx"
ON "VisitPlan"("nextFollowUpAt");

ALTER TABLE "EventRegistration"
ADD COLUMN "checkedInAt" TIMESTAMP(3),
ADD COLUMN "checkedInById" TEXT;

CREATE INDEX "EventRegistration_eventId_checkedInAt_idx"
ON "EventRegistration"("eventId", "checkedInAt");
