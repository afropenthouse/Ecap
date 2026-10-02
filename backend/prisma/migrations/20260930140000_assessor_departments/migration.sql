CREATE TABLE "AssessorDepartment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assessorId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "AssessorDepartment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssessorDepartment_assessorId_departmentId_key" ON "AssessorDepartment"("assessorId", "departmentId");
CREATE INDEX "AssessorDepartment_organizationId_assessorId_idx" ON "AssessorDepartment"("organizationId", "assessorId");

ALTER TABLE "AssessorDepartment" ADD CONSTRAINT "AssessorDepartment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessorDepartment" ADD CONSTRAINT "AssessorDepartment_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessorDepartment" ADD CONSTRAINT "AssessorDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
