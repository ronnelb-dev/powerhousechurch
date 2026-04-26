CREATE TABLE "VisitPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "preferredService" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3),
    "adultCount" INTEGER NOT NULL DEFAULT 1,
    "isFirstTimeGuest" BOOLEAN NOT NULL DEFAULT true,
    "bringingKids" BOOLEAN NOT NULL DEFAULT false,
    "kidsCount" INTEGER,
    "kidsDetails" TEXT,
    "wantsUsherFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "wantsPastorFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VisitPlan_submittedAt_idx"
ON "VisitPlan"("submittedAt");

CREATE INDEX "VisitPlan_status_submittedAt_idx"
ON "VisitPlan"("status", "submittedAt");

CREATE INDEX "VisitPlan_preferredService_submittedAt_idx"
ON "VisitPlan"("preferredService", "submittedAt");

CREATE INDEX "VisitPlan_visitDate_idx"
ON "VisitPlan"("visitDate");
