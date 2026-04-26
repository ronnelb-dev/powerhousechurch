CREATE TABLE "OutboundEmail" (
    "id" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "textBody" TEXT,
    "tag" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundEmail_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutboundEmail_status_nextAttemptAt_idx" ON "OutboundEmail"("status", "nextAttemptAt");
CREATE INDEX "OutboundEmail_createdAt_idx" ON "OutboundEmail"("createdAt");
CREATE INDEX "OutboundEmail_tag_createdAt_idx" ON "OutboundEmail"("tag", "createdAt");
