-- Adult attendance v2 is additive. The legacy "Attendance" table remains the
-- rollback source until the staged rollout and reconciliation are complete.
CREATE TYPE "AttendanceType" AS ENUM ('SUNDAY_SERVICE', 'CELL_GROUP');
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');
CREATE TYPE "AttendanceSessionState" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "AttendanceSession" (
  "id" TEXT NOT NULL,
  "churchDate" DATE NOT NULL,
  "type" "AttendanceType" NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "cellGroupId" TEXT,
  "state" "AttendanceSessionState" NOT NULL DEFAULT 'OPEN',
  "rosterComplete" BOOLEAN NOT NULL DEFAULT true,
  "openedById" TEXT,
  "closedById" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceSession_scope_check" CHECK (
    ("type" = 'SUNDAY_SERVICE' AND "scopeKey" = 'GLOBAL' AND "cellGroupId" IS NULL)
    OR
    ("type" = 'CELL_GROUP'
      AND "scopeKey" LIKE 'CELL_GROUP:%'
      AND ("cellGroupId" IS NULL OR "scopeKey" = 'CELL_GROUP:' || "cellGroupId"))
  )
);

CREATE TABLE "AttendanceRosterEntry" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "churchDate" DATE NOT NULL,
  "type" "AttendanceType" NOT NULL,
  "firstNameSnapshot" TEXT NOT NULL,
  "lastNameSnapshot" TEXT NOT NULL,
  "cellGroupIdSnapshot" TEXT,
  "cellGroupNameSnapshot" TEXT,
  "status" "AttendanceStatus",
  "version" INTEGER NOT NULL DEFAULT 0,
  "markedById" TEXT,
  "markedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceRosterEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceRosterEntry_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "AttendanceChange" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "rosterEntryId" TEXT NOT NULL,
  "userIdSnapshot" TEXT NOT NULL,
  "memberNameSnapshot" TEXT NOT NULL,
  "previousStatus" "AttendanceStatus",
  "nextStatus" "AttendanceStatus",
  "expectedVersion" INTEGER NOT NULL,
  "resultVersion" INTEGER NOT NULL,
  "actorId" TEXT,
  "actorRoleSnapshot" TEXT NOT NULL,
  "actorNameSnapshot" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceChange_versions_check" CHECK (
    "expectedVersion" >= 0 AND "resultVersion" = "expectedVersion" + 1
  )
);

CREATE UNIQUE INDEX "AttendanceSession_churchDate_type_scopeKey_key"
  ON "AttendanceSession"("churchDate", "type", "scopeKey");
CREATE INDEX "AttendanceSession_state_churchDate_idx"
  ON "AttendanceSession"("state", "churchDate");
CREATE INDEX "AttendanceSession_cellGroupId_churchDate_idx"
  ON "AttendanceSession"("cellGroupId", "churchDate");
CREATE INDEX "AttendanceSession_type_churchDate_idx"
  ON "AttendanceSession"("type", "churchDate");

CREATE UNIQUE INDEX "AttendanceRosterEntry_sessionId_userId_key"
  ON "AttendanceRosterEntry"("sessionId", "userId");
CREATE UNIQUE INDEX "AttendanceRosterEntry_userId_type_churchDate_key"
  ON "AttendanceRosterEntry"("userId", "type", "churchDate");
CREATE INDEX "AttendanceRosterEntry_sessionId_status_idx"
  ON "AttendanceRosterEntry"("sessionId", "status");
CREATE INDEX "AttendanceRosterEntry_userId_sessionId_idx"
  ON "AttendanceRosterEntry"("userId", "sessionId");

CREATE INDEX "AttendanceChange_sessionId_createdAt_idx"
  ON "AttendanceChange"("sessionId", "createdAt");
CREATE INDEX "AttendanceChange_rosterEntryId_createdAt_idx"
  ON "AttendanceChange"("rosterEntryId", "createdAt");
CREATE INDEX "AttendanceChange_actorId_createdAt_idx"
  ON "AttendanceChange"("actorId", "createdAt");
CREATE INDEX "AttendanceChange_correlationId_idx"
  ON "AttendanceChange"("correlationId");

ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_cellGroupId_fkey"
  FOREIGN KEY ("cellGroupId") REFERENCES "CellGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_openedById_fkey"
  FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceRosterEntry" ADD CONSTRAINT "AttendanceRosterEntry_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRosterEntry" ADD CONSTRAINT "AttendanceRosterEntry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRosterEntry" ADD CONSTRAINT "AttendanceRosterEntry_markedById_fkey"
  FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceChange" ADD CONSTRAINT "AttendanceChange_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceChange" ADD CONSTRAINT "AttendanceChange_rosterEntryId_fkey"
  FOREIGN KEY ("rosterEntryId") REFERENCES "AttendanceRosterEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceChange" ADD CONSTRAINT "AttendanceChange_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The status ledger is append-only even for the database owner. Corrections
-- are represented by a new row, never by rewriting history.
CREATE FUNCTION prevent_attendance_change_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AttendanceChange is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AttendanceChange_immutable_update"
  BEFORE UPDATE ON "AttendanceChange"
  FOR EACH ROW EXECUTE FUNCTION prevent_attendance_change_mutation();
CREATE TRIGGER "AttendanceChange_immutable_delete"
  BEFORE DELETE ON "AttendanceChange"
  FOR EACH ROW EXECUTE FUNCTION prevent_attendance_change_mutation();
