-- Keep one requirement for each competency within a job and organisation.
-- Fail safely if pre-existing duplicates need to be reviewed before applying.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "JobCompetency"
    GROUP BY "organizationId", "jobId", "competencyId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate job competency requirements exist. Review and resolve them before applying this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX "JobCompetency_organizationId_jobId_competencyId_key"
ON "JobCompetency"("organizationId", "jobId", "competencyId");
