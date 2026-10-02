import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authMiddleware, rbac } from '../middleware/auth';

const router = Router();
const completedStatuses = ['COMPLETED', 'REVIEWED'] as const;

async function getRequiredCompetencyIds(organizationId: string, employeeId: string) {
  const assignment = await prisma.employeeJobAssignment.findFirst({
    where: {
      organizationId,
      employeeId,
      OR: [{ startDate: null }, { startDate: { lte: new Date() } }],
    },
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    include: { job: { include: { requirements: true } } },
  });
  return assignment?.job.requirements.map(requirement => requirement.competencyId) || [];
}

async function getAssessmentCompetencyIds(organizationId: string, employeeId: string) {
  const requiredIds = await getRequiredCompetencyIds(organizationId, employeeId);
  if (requiredIds.length > 0) return requiredIds;
  const competencies = await prisma.competency.findMany({ where: { organizationId }, select: { id: true } });
  return competencies.map(competency => competency.id);
}

async function hasAllRequiredRatings(assessmentId: string, requiredCompetencyIds: string[]) {
  if (requiredCompetencyIds.length === 0) return true;
  const ratings = await prisma.assessmentRating.findMany({ where: { assessmentId }, select: { competencyId: true } });
  const rated = new Set(ratings.map(rating => rating.competencyId));
  return requiredCompetencyIds.every(competencyId => rated.has(competencyId));
}

// Assessors and HR see all assessments in their organisation; employees see their own.
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const where: any = { organizationId: req.user!.organizationId };
    if (req.user!.role === 'EMPLOYEE') where.employeeId = req.user!.id;
    const list = await prisma.assessment.findMany({ where, include: { ratings: true }, orderBy: { createdAt: 'desc' } });
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list assessments' });
  }
});

router.post('/self', authMiddleware, rbac(['EMPLOYEE']), async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const active = await prisma.assessment.findFirst({
      where: { organizationId, employeeId: req.user!.id, type: 'SELF', status: { in: ['PENDING', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (active) return res.json(active);

    const created = await prisma.assessment.create({
      data: { organizationId, type: 'SELF', status: 'PENDING', employeeId: req.user!.id },
    });
    res.status(201).json(created);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create assessment' });
  }
});

// An assessor may create an assessment only for an employee assigned to them.
router.post('/assessor', authMiddleware, rbac(['ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.body as { employeeId: string };
    if (!employeeId) return res.status(400).json({ error: 'employeeId is required.' });
    const organizationId = req.user!.organizationId;
    const [employee, assignment] = await Promise.all([
      prisma.user.findFirst({ where: { id: employeeId, organizationId, role: 'EMPLOYEE' } }),
      prisma.assessorAssignment.findFirst({ where: { organizationId, employeeId, assessorId: req.user!.id } }),
    ]);
    if (!employee) return res.status(404).json({ error: 'Employee not found in this organisation.' });
    if (!assignment) return res.status(403).json({ error: 'You are not assigned to assess this employee.' });
    const existing = await prisma.assessment.findFirst({ where: { organizationId, employeeId, assessorId: req.user!.id, type: 'ASSESSOR' } });
    if (existing) return res.json(existing);
    const created = await prisma.assessment.create({
      data: { organizationId, type: 'ASSESSOR', status: 'PENDING', employeeId, assessorId: req.user!.id },
    });
    res.status(201).json(created);
  } catch (e: any) {
    console.error(e);
    if (e?.code === 'P2002') return res.status(409).json({ error: 'An assessment already exists for this employee.' });
    res.status(500).json({ error: 'Failed to create assessment' });
  }
});

router.put('/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED' };
    if (!['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED'].includes(status)) return res.status(400).json({ error: 'Invalid assessment status.' });
    const assessment = await prisma.assessment.findFirst({ where: { id, organizationId: req.user!.organizationId } });
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const employeeOwner = req.user!.role === 'EMPLOYEE' && assessment.type === 'SELF' && assessment.employeeId === req.user!.id;
    const assessorOwner = req.user!.role === 'ASSESSOR' && assessment.type === 'ASSESSOR' && assessment.assessorId === req.user!.id;
    if (!employeeOwner && !assessorOwner) return res.status(403).json({ error: 'You cannot change this assessment.' });
    if (assessorOwner) {
      const assignment = await prisma.assessorAssignment.findFirst({ where: { organizationId: assessment.organizationId, employeeId: assessment.employeeId, assessorId: req.user!.id } });
      if (!assignment) return res.status(403).json({ error: 'You are no longer assigned to this employee; this assessment is view-only.' });
    }
    if (employeeOwner && !['IN_PROGRESS', 'COMPLETED'].includes(status)) return res.status(400).json({ error: 'Employees can only start or complete a self-assessment.' });
    if (assessorOwner && !['IN_PROGRESS', 'REVIEWED'].includes(status)) return res.status(400).json({ error: 'Assessors can only start or review an assessor assessment.' });
    if (assessment.status === 'COMPLETED' || assessment.status === 'REVIEWED') return res.status(409).json({ error: 'This assessment is already complete and cannot be changed.' });

    const requiredCompetencyIds = await getAssessmentCompetencyIds(req.user!.organizationId, assessment.employeeId);
    if ((status === 'COMPLETED' || status === 'REVIEWED') && !(await hasAllRequiredRatings(assessment.id, requiredCompetencyIds))) {
      return res.status(409).json({ error: 'Rate every competency in this assessment before completing it.' });
    }

    const updated = await prisma.$transaction(async tx => {
      const saved = await tx.assessment.update({
        where: { id },
        data: {
          status,
          ...(status === 'IN_PROGRESS' && !assessment.startedAt ? { startedAt: new Date() } : {}),
          ...((status === 'COMPLETED' || status === 'REVIEWED') ? { completedAt: new Date() } : {}),
        },
        include: { ratings: true },
      });

      if (assessment.type === 'SELF' && status === 'COMPLETED') {
        const assignments = await tx.assessorAssignment.findMany({ where: { organizationId: assessment.organizationId, employeeId: assessment.employeeId } });
        for (const assignment of assignments) {
          const existing = await tx.assessment.findFirst({ where: { organizationId: assessment.organizationId, type: 'ASSESSOR', employeeId: assessment.employeeId, assessorId: assignment.assessorId } });
          if (!existing) {
            await tx.assessment.create({
              data: { organizationId: assessment.organizationId, type: 'ASSESSOR', status: 'PENDING', employeeId: assessment.employeeId, assessorId: assignment.assessorId },
            });
          }
        }
      }
      return saved;
    });
    res.json(updated);
  } catch (e: any) {
    console.error(e);
    if (e?.code === 'P2002') return res.status(409).json({ error: 'An assessment already exists for this employee and assessor.' });
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.post('/:id/ratings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { competencyId, rating, comment } = req.body as { competencyId: string; rating: number; comment?: string };
    const assessment = await prisma.assessment.findFirst({ where: { id, organizationId: req.user!.organizationId } });
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    const allowedOwner = (assessment.type === 'SELF' && req.user!.role === 'EMPLOYEE' && assessment.employeeId === req.user!.id)
      || (assessment.type === 'ASSESSOR' && req.user!.role === 'ASSESSOR' && assessment.assessorId === req.user!.id);
    if (!allowedOwner) return res.status(403).json({ error: 'You cannot rate this assessment.' });
    if (assessment.type === 'ASSESSOR') {
      const assignment = await prisma.assessorAssignment.findFirst({ where: { organizationId: assessment.organizationId, employeeId: assessment.employeeId, assessorId: req.user!.id } });
      if (!assignment) return res.status(403).json({ error: 'You are no longer assigned to this employee; this assessment is view-only.' });
    }
    if (!['PENDING', 'IN_PROGRESS'].includes(assessment.status)) return res.status(409).json({ error: 'This assessment is no longer open for ratings.' });
    if (!competencyId || !Number.isInteger(rating)) return res.status(400).json({ error: 'A competency and whole-number proficiency rating are required.' });

    const [level, competencyIds] = await Promise.all([
      prisma.proficiencyLevel.findFirst({ where: { organizationId: req.user!.organizationId, levelNumber: rating } }),
      getAssessmentCompetencyIds(req.user!.organizationId, assessment.employeeId),
    ]);
    if (!level) {
      const configuredLevelCount = await prisma.proficiencyLevel.count({ where: { organizationId: req.user!.organizationId } });
      if (configuredLevelCount > 0 || rating < 1 || rating > 5) return res.status(400).json({ error: 'Choose one of the configured proficiency levels, or a rating from 1 to 5 when none are configured.' });
    }
    if (!competencyIds.includes(competencyId)) return res.status(400).json({ error: 'This competency is not required by the employee’s current job profile.' });

    const existingRating = await prisma.assessmentRating.findFirst({ where: { organizationId: req.user!.organizationId, assessmentId: id, competencyId } });
    const saved = existingRating
      ? await prisma.assessmentRating.update({ where: { id: existingRating.id }, data: { rating, comment } })
      : await prisma.assessmentRating.create({ data: { organizationId: req.user!.organizationId, assessmentId: id, competencyId, rating, comment } });
    res.status(200).json(saved);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save rating' });
  }
});

// HR finalizes a persisted consensus from the employee's self-rating and all assigned assessors.
router.post('/consensus/:employeeId', authMiddleware, rbac(['HR']), async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const organizationId = req.user!.organizationId;
    const [selfAssessment, assignments, requiredCompetencyIds] = await Promise.all([
      prisma.assessment.findFirst({ where: { organizationId, employeeId, type: 'SELF', status: { in: [...completedStatuses] } }, orderBy: { createdAt: 'desc' }, include: { ratings: true } }),
      prisma.assessorAssignment.findMany({ where: { organizationId, employeeId }, include: { assessor: { select: { id: true, firstName: true, lastName: true, email: true } } } }),
      getAssessmentCompetencyIds(organizationId, employeeId),
    ]);
    if (!selfAssessment) return res.status(409).json({ error: 'The employee must complete a self-assessment before consensus can be finalized.' });
    if (assignments.length === 0) return res.status(409).json({ error: 'No assessors are assigned to this employee.' });

    const assessorAssessments = await prisma.assessment.findMany({
      where: { organizationId, employeeId, type: 'ASSESSOR', assessorId: { in: assignments.map(assignment => assignment.assessorId) } },
      include: { ratings: true },
      orderBy: { createdAt: 'desc' },
    });
    const assessorById = new Map<string, typeof assessorAssessments[number]>();
    for (const assessorAssessment of assessorAssessments) {
      if (assessorAssessment.assessorId && !assessorById.has(assessorAssessment.assessorId)) assessorById.set(assessorAssessment.assessorId, assessorAssessment);
    }
    const notReady = assignments.filter(assignment => {
      const assessorAssessment = assessorById.get(assignment.assessorId);
      return !assessorAssessment || !completedStatuses.includes(assessorAssessment.status as typeof completedStatuses[number]);
    });
    if (notReady.length) return res.status(409).json({ error: 'Every assigned assessor must complete their assessment before consensus can be finalized.' });

    const allAssessorAssessments = assignments.map(assignment => assessorById.get(assignment.assessorId)!);
    const selfByCompetency = new Map(selfAssessment.ratings.map(rating => [rating.competencyId, rating]));
    const assessorRatingMaps = allAssessorAssessments.map(assessment => new Map(assessment.ratings.map(rating => [rating.competencyId, rating])));
    const consensusRatings = requiredCompetencyIds.flatMap(competencyId => {
      const values = [selfByCompetency.get(competencyId)?.rating, ...assessorRatingMaps.map(map => map.get(competencyId)?.rating)].filter((value): value is number => typeof value === 'number');
      if (values.length !== assignments.length + 1) return [];
      return [{ competencyId, rating: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) }];
    });
    if (!consensusRatings.length || consensusRatings.length !== requiredCompetencyIds.length) return res.status(409).json({ error: 'Every assigned reviewer must rate every competency before consensus can be finalized.' });

    const consensus = await prisma.$transaction(async tx => {
      const existing = await tx.assessment.findFirst({ where: { organizationId, employeeId, type: 'CONSENSUS', assessorId: null } });
      const assessment = existing
        ? await tx.assessment.update({ where: { id: existing.id }, data: { status: 'REVIEWED', completedAt: new Date() } })
        : await tx.assessment.create({ data: { organizationId, employeeId, type: 'CONSENSUS', status: 'REVIEWED', completedAt: new Date() } });
      for (const consensusRating of consensusRatings) {
        const existingRating = await tx.assessmentRating.findFirst({ where: { organizationId, assessmentId: assessment.id, competencyId: consensusRating.competencyId } });
        if (existingRating) {
          await tx.assessmentRating.update({ where: { id: existingRating.id }, data: { rating: consensusRating.rating, comment: 'Consensus average' } });
        } else {
          await tx.assessmentRating.create({ data: { organizationId, assessmentId: assessment.id, competencyId: consensusRating.competencyId, rating: consensusRating.rating, comment: 'Consensus average' } });
        }
      }
      await tx.assessmentRating.deleteMany({ where: { organizationId, assessmentId: assessment.id, competencyId: { notIn: requiredCompetencyIds } } });
      return tx.assessment.findUnique({ where: { id: assessment.id }, include: { ratings: true } });
    });
    res.json(consensus);
  } catch (e: any) {
    console.error(e);
    if (e?.code === 'P2002') return res.status(409).json({ error: 'A consensus assessment already exists. Refresh the page and try again.' });
    res.status(500).json({ error: 'Failed to finalize consensus assessment' });
  }
});

export default router;
