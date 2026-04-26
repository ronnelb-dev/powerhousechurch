-- CreateTable
CREATE TABLE "ChildProfile" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "preferredName" TEXT,
    "gender" TEXT,
    "birthday" TIMESTAMP(3) NOT NULL,
    "classroom" TEXT,
    "allergies" TEXT,
    "medicalNotes" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildGuardian" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "userId" TEXT,
    "relationship" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "canPickup" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildAttendance" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL DEFAULT 'KIDS_CHURCH',
    "status" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "markedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChildProfile_lastName_firstName_idx" ON "ChildProfile"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "ChildProfile_classroom_idx" ON "ChildProfile"("classroom");

-- CreateIndex
CREATE INDEX "ChildProfile_isActive_idx" ON "ChildProfile"("isActive");

-- CreateIndex
CREATE INDEX "ChildGuardian_childId_idx" ON "ChildGuardian"("childId");

-- CreateIndex
CREATE INDEX "ChildGuardian_userId_idx" ON "ChildGuardian"("userId");

-- CreateIndex
CREATE INDEX "ChildGuardian_isPrimaryContact_idx" ON "ChildGuardian"("isPrimaryContact");

-- CreateIndex
CREATE INDEX "ChildAttendance_childId_date_idx" ON "ChildAttendance"("childId", "date");

-- CreateIndex
CREATE INDEX "ChildAttendance_date_serviceType_idx" ON "ChildAttendance"("date", "serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "ChildAttendance_childId_serviceType_date_key" ON "ChildAttendance"("childId", "serviceType", "date");

-- AddForeignKey
ALTER TABLE "ChildGuardian" ADD CONSTRAINT "ChildGuardian_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildGuardian" ADD CONSTRAINT "ChildGuardian_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildAttendance" ADD CONSTRAINT "ChildAttendance_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildAttendance" ADD CONSTRAINT "ChildAttendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
