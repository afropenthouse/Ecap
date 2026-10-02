import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authMiddleware, rbac } from '../middleware/auth';

const router = Router();

async function createAssessmentIfSelfIsComplete(organizationId: string, employeeId: string, assessorId: string, tx: any) {
  const selfAssessment = await tx.assessment.findFirst({
    where: { organizationId, employeeId, type: 'SELF', status: { in: ['COMPLETED', 'REVIEWED'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!selfAssessment) return;
  const existing = await tx.assessment.findFirst({ where: { organizationId, employeeId, assessorId, type: 'ASSESSOR' } });
  if (!existing) await tx.assessment.create({ data: { organizationId, employeeId, assessorId, type: 'ASSESSOR', status: 'PENDING' } });
}

// List assessor assignments
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { employeeId, assessorId } = req.query as { employeeId?: string; assessorId?: string };
    const where: any = { organizationId: req.user!.organizationId };
    if (req.user!.role === 'ASSESSOR') where.assessorId = req.user!.id;
    else if (assessorId) where.assessorId = assessorId;
    if (req.user!.role === 'EMPLOYEE') where.employeeId = req.user!.id;
    else if (employeeId) where.employeeId = employeeId;

    const rows = await prisma.assessorAssignment.findMany({
      where,
      include: {
        assessor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        employee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list assignments' });
  }
});

// Create assignment (HR only)
router.post('/', authMiddleware, rbac(['HR']), async (req: Request, res: Response) => {
  try {
    const { assessorId, employeeId } = req.body as { assessorId: string; employeeId: string };
    if (!assessorId || !employeeId) return res.status(400).json({ error: 'assessorId and employeeId are required' });

    const [assessor, employee] = await Promise.all([
      prisma.user.findUnique({ where: { id: assessorId } }),
      prisma.user.findUnique({ where: { id: employeeId } }),
    ]);
    if (!assessor || !employee) return res.status(404).json({ error: 'User not found' });
    if (assessor.organizationId !== req.user!.organizationId || employee.organizationId !== req.user!.organizationId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    // Optional validation: ensure assessor has ASSESSOR role and employee has EMPLOYEE role
    if (assessor.role !== 'ASSESSOR') return res.status(400).json({ error: 'Selected user is not an assessor' });
    if (employee.role !== 'EMPLOYEE') return res.status(400).json({ error: 'Selected user is not an employee' });

    try {
      const created = await prisma.$transaction(async tx => {
        const assignment = await tx.assessorAssignment.create({
          data: { organizationId: req.user!.organizationId, assessorId, employeeId },
        });
        await createAssessmentIfSelfIsComplete(req.user!.organizationId, employeeId, assessorId, tx);
        return assignment;
      });
      res.status(201).json(created);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'Assignment already exists for assessor and employee' });
      }
      throw err;
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

// Update assignment (HR only)
router.put('/:id', authMiddleware, rbac(['HR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { assessorId, employeeId } = req.body as { assessorId?: string; employeeId?: string };

    const existing = await prisma.assessorAssignment.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== req.user!.organizationId) return res.status(404).json({ error: 'Assignment not found' });

    const [assessor, employee] = await Promise.all([
      prisma.user.findUnique({ where: { id: assessorId ?? existing.assessorId } }),
      prisma.user.findUnique({ where: { id: employeeId ?? existing.employeeId } }),
    ]);
    if (!assessor || assessor.organizationId !== req.user!.organizationId || assessor.role !== 'ASSESSOR') {
      return res.status(400).json({ error: 'Select an assessor from your organization' });
    }
    if (!employee || employee.organizationId !== req.user!.organizationId || employee.role !== 'EMPLOYEE') {
      return res.status(400).json({ error: 'Select an employee from your organization' });
    }

    const updated = await prisma.$transaction(async tx => {
      const assignment = await tx.assessorAssignment.update({ where: { id }, data: { assessorId, employeeId } });
      await createAssessmentIfSelfIsComplete(req.user!.organizationId, employeeId ?? existing.employeeId, assessorId ?? existing.assessorId, tx);
      return assignment;
    });
    res.json(updated);
  } catch (e) {
    console.error(e);
    if ((e as any)?.code === 'P2002') return res.status(409).json({ error: 'Assignment already exists for this assessor and employee' });
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// Delete assignment (HR only)
router.delete('/:id', authMiddleware, rbac(['HR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.assessorAssignment.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== req.user!.organizationId) return res.status(404).json({ error: 'Assignment not found' });
    await prisma.assessorAssignment.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

export default router;
