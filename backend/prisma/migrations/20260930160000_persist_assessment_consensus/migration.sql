-- Preserve rating values while allowing consensus averages to be decimal.
ALTER TABLE "AssessmentRating"
  ALTER COLUMN "rating" TYPE DOUBLE PRECISION
  USING "rating"::DOUBLE PRECISION;

-- Preserve all historical records; stop and request review if previous repeated saves
-- produced duplicates that cannot be reconciled safely without choosing a rating.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "AssessmentRating"
    GROUP BY "organizationId", "assessmentId", "competencyId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate assessment ratings exist. Review them before applying the assessment uniqueness constraint.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Assessment"
    WHERE "type" = 'ASSESSOR' AND "assessorId" IS NOT NULL
    GROUP BY "organizationId", "employeeId", "assessorId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate assessor assessments exist. Review them before applying the assessment uniqueness constraint.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Assessment"
    WHERE "type" = 'CONSENSUS'
    GROUP BY "organizationId", "employeeId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate consensus assessments exist. Review them before applying the assessment uniqueness constraint.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Assessment"
    WHERE "type" = 'SELF' AND "status" IN ('PENDING', 'IN_PROGRESS')
    GROUP BY "organizationId", "employeeId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple active self-assessments exist. Review them before applying the assessment uniqueness constraint.';
  END IF;
END $$;

CREATE UNIQUE INDEX "AssessmentRating_organizationId_assessmentId_competencyId_key"
  ON "AssessmentRating"("organizationId", "assessmentId", "competencyId");

CREATE UNIQUE INDEX "Assessment_one_assessor_per_employee"
  ON "Assessment"("organizationId", "employeeId", "assessorId")
  WHERE "type" = 'ASSESSOR' AND "assessorId" IS NOT NULL;

CREATE UNIQUE INDEX "Assessment_one_consensus_per_employee"
  ON "Assessment"("organizationId", "employeeId")
  WHERE "type" = 'CONSENSUS';

CREATE UNIQUE INDEX "Assessment_one_active_self_per_employee"
  ON "Assessment"("organizationId", "employeeId")
  WHERE "type" = 'SELF' AND "status" IN ('PENDING', 'IN_PROGRESS');
