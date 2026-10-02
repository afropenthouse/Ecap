import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authMiddleware, rbac } from '../middleware/auth';

const router = Router();

// List jobs (all roles) scoped to organization
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { organizationId: req.user!.organizationId },
      include: { department: true, requirements: true },
    });
    res.json(jobs);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

// Create job (HR & Assessor)
router.post('/', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { title, description, departmentId } = req.body as { title: string; description?: string; departmentId?: string | null };
    if (!title?.trim()) return res.status(400).json({ error: 'Job title is required.' });
    if (departmentId) {
      const department = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!department || department.organizationId !== req.user!.organizationId) return res.status(400).json({ error: 'Choose a department in your organisation.' });
    }
    const job = await prisma.job.create({
      data: { organizationId: req.user!.organizationId, title: title.trim(), description, departmentId: departmentId || null },
    });
    res.status(201).json(job);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Update job (HR & Assessor) with org scoping
router.put('/:id', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, departmentId } = req.body as { title?: string; description?: string; departmentId?: string | null };

    const existing = await prisma.job.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Job not found' });
    if (existing.organizationId !== req.user!.organizationId) return res.status(403).json({ error: 'Forbidden' });
    if (title !== undefined && !title.trim()) return res.status(400).json({ error: 'Job title is required.' });
    if (departmentId) {
      const department = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!department || department.organizationId !== req.user!.organizationId) return res.status(400).json({ error: 'Choose a department in your organisation.' });
    }

    const job = await prisma.job.update({ where: { id }, data: { title: title?.trim(), description, departmentId: departmentId === '' ? null : departmentId } });
    res.json(job);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// Delete job (HR & Assessor) with org scoping
router.delete('/:id', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job || job.organizationId !== req.user!.organizationId) return res.status(404).json({ error: 'Job not found' });

    const assignmentCount = await prisma.employeeJobAssignment.count({ where: { organizationId: req.user!.organizationId, jobId: id } });
    if (assignmentCount > 0) return res.status(409).json({ error: 'This job is assigned to employees. Reassign or remove those employee assignments before deleting it.' });

    // Requirements can be removed with the job once there are no employee assignments.
    await prisma.$transaction([
      prisma.jobCompetency.deleteMany({ where: { organizationId: req.user!.organizationId, jobId: id } }),
      prisma.job.delete({ where: { id } }),
    ]);

    res.json({ success: true });
  } catch (e: any) {
    console.error(e);
    if (e?.code === 'P2003') return res.status(409).json({ error: 'This job is still in use. Remove its employee assignments before deleting it.' });
    return res.status(500).json({ error: 'Failed to delete job' });
  }
});

// Add job competency requirement (HR & Assessor)
router.post('/:id/requirements', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { competencyId, requiredLevel } = req.body as { competencyId: string; requiredLevel: number };
    if (!competencyId || !Number.isInteger(requiredLevel) || requiredLevel < 1) return res.status(400).json({ error: 'Choose a competency and configured proficiency level.' });
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job || job.organizationId !== req.user!.organizationId) return res.status(404).json({ error: 'Job not found' });

    // Validate competency belongs to same org
    const comp = await prisma.competency.findUnique({ where: { id: competencyId } });
    if (!comp || comp.organizationId !== req.user!.organizationId) return res.status(404).json({ error: 'Competency not found' });

    const level = await prisma.proficiencyLevel.findFirst({ where: { organizationId: req.user!.organizationId, levelNumber: requiredLevel } });
    if (!level) return res.status(400).json({ error: 'Choose one of the proficiency levels configured for your organisation.' });

    const duplicate = await prisma.jobCompetency.findFirst({ where: { organizationId: req.user!.organizationId, jobId: id, competencyId } });
    if (duplicate) return res.status(409).json({ error: 'This job already has a requirement for that competency.' });

    const jc = await prisma.jobCompetency.create({
      data: { organizationId: req.user!.organizationId, jobId: id, competencyId, requiredLevel },
    });
    res.status(201).json(jc);
  } catch (e: any) {
    console.error(e);
    if (e?.code === 'P2002') return res.status(409).json({ error: 'This job already has a requirement for that competency.' });
    res.status(500).json({ error: 'Failed to add requirement' });
  }
});

// Update job competency requirement (HR & Assessor)
router.put('/:id/requirements/:reqId', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { id, reqId } = req.params;
    const { competencyId, requiredLevel } = req.body as { competencyId?: string; requiredLevel?: number };

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job || job.organizationId !== req.user!.organizationId) return res.status(404).json({ error: 'Job not found' });

    const existingReq = await prisma.jobCompetency.findUnique({ where: { id: reqId } });
    if (!existingReq || existingReq.organizationId !== req.user!.organizationId || existingReq.jobId !== id) {
      return res.status(404).json({ error: 'Requirement not found' });
    }

    const updateData: any = {};
    if (requiredLevel !== undefined) {
      if (!Number.isInteger(requiredLevel) || requiredLevel < 1) return res.status(400).json({ error: 'Choose a configured proficiency level.' });
      const level = await prisma.proficiencyLevel.findFirst({ where: { organizationId: req.user!.organizationId, levelNumber: requiredLevel } });
      if (!level) return res.status(400).json({ error: 'Choose one of the proficiency levels configured for your organisation.' });
      updateData.requiredLevel = requiredLevel;
    }

    if (competencyId) {
      const comp = await prisma.competency.findUnique({ where: { id: competencyId } });
      if (!comp || comp.organizationId !== req.user!.organizationId) return res.status(404).json({ error: 'Competency not found' });
      const duplicate = await prisma.jobCompetency.findFirst({ where: { organizationId: req.user!.organizationId, jobId: id, competencyId, id: { not: reqId } } });
      if (duplicate) return res.status(409).json({ error: 'This job already has a requirement for that competency.' });
      updateData.competencyId = competencyId;
    }

    const updated = await prisma.jobCompetency.update({ where: { id: reqId }, data: updateData });
    res.json(updated);
  } catch (e: any) {
    console.error(e);
    if (e?.code === 'P2002') return res.status(409).json({ error: 'This job already has a requirement for that competency.' });
    res.status(500).json({ error: 'Failed to update requirement' });
  }
});

// Delete job competency requirement (HR & Assessor)
router.delete('/:id/requirements/:reqId', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { id, reqId } = req.params;
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job || job.organizationId !== req.user!.organizationId) return res.status(404).json({ error: 'Job not found' });

    const existingReq = await prisma.jobCompetency.findUnique({ where: { id: reqId } });
    if (!existingReq || existingReq.organizationId !== req.user!.organizationId || existingReq.jobId !== id) {
      return res.status(404).json({ error: 'Requirement not found' });
    }

    await prisma.jobCompetency.delete({ where: { id: reqId } });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete requirement' });
  }
});

export default router;
