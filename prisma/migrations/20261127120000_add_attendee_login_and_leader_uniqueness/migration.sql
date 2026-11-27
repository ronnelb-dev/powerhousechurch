-- Attendees created at check-in may not yet have profile demographics.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ALTER COLUMN "age" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "gender" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "birthday" DROP NOT NULL;

ALTER TABLE "PasswordResetToken"
  ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'PASSWORD_RESET';

-- A leader picker can only resolve one group per leader. Stop with the
-- conflicting leader IDs so an administrator can resolve assignments manually.
DO $$
DECLARE
  duplicate_leaders TEXT;
BEGIN
  SELECT string_agg("leaderId" || ' (' || group_count || ' groups)', ', ')
    INTO duplicate_leaders
  FROM (
    SELECT "leaderId", COUNT(*) AS group_count
    FROM "CellGroup"
    GROUP BY "leaderId"
    HAVING COUNT(*) > 1
  ) AS duplicates;

  IF duplicate_leaders IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot enforce one group per leader. Resolve these leader assignments first: %', duplicate_leaders;
  END IF;
END $$;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "CellGroup_leaderId_key" ON "CellGroup"("leaderId");
DROP INDEX IF EXISTS "CellGroup_leaderId_idx";
