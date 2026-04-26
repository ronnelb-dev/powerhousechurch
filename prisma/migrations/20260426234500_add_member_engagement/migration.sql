ALTER TABLE "PrayerRequest"
ADD COLUMN "memberId" TEXT;

ALTER TABLE "PrayerRequest"
ADD CONSTRAINT "PrayerRequest_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "PrayerRequest_memberId_submittedAt_idx"
ON "PrayerRequest"("memberId", "submittedAt");

CREATE TABLE "SermonBookmark" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sermonId" TEXT NOT NULL,
  "note" TEXT,
  "isBookmarked" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SermonBookmark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SermonBookmark_userId_sermonId_key"
ON "SermonBookmark"("userId", "sermonId");

CREATE INDEX "SermonBookmark_userId_updatedAt_idx"
ON "SermonBookmark"("userId", "updatedAt");

CREATE INDEX "SermonBookmark_sermonId_idx"
ON "SermonBookmark"("sermonId");

ALTER TABLE "SermonBookmark"
ADD CONSTRAINT "SermonBookmark_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "SermonBookmark"
ADD CONSTRAINT "SermonBookmark_sermonId_fkey"
FOREIGN KEY ("sermonId") REFERENCES "Sermon"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

CREATE TABLE "ServingInterest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "ministryId" TEXT,
  "areaOfInterest" TEXT NOT NULL,
  "availability" TEXT,
  "experience" TEXT,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServingInterest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServingInterest_userId_status_createdAt_idx"
ON "ServingInterest"("userId", "status", "createdAt");

CREATE INDEX "ServingInterest_ministryId_status_idx"
ON "ServingInterest"("ministryId", "status");

ALTER TABLE "ServingInterest"
ADD CONSTRAINT "ServingInterest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ServingInterest"
ADD CONSTRAINT "ServingInterest_ministryId_fkey"
FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "prayerUpdatesEmail" BOOLEAN NOT NULL DEFAULT true,
  "sermonAnnouncements" BOOLEAN NOT NULL DEFAULT true,
  "servingOpportunities" BOOLEAN NOT NULL DEFAULT true,
  "eventReminders" BOOLEAN NOT NULL DEFAULT true,
  "smsUrgentCare" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_userId_key"
ON "NotificationPreference"("userId");

ALTER TABLE "NotificationPreference"
ADD CONSTRAINT "NotificationPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
