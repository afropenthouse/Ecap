import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authMiddleware, rbac } from '../middleware/auth';

const router = Router();

// Domains
router.get('/domains', authMiddleware, async (req: Request, res: Response) => {
  try {
    const domains = await prisma.competencyDomain.findMany({ where: { organizationId: req.user!.organizationId } });
    res.json(domains);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list domains' });
  }
});

router.post('/domains', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { domainName } = req.body as { domainName: string };
    const created = await prisma.competencyDomain.create({ data: { organizationId: req.user!.organizationId, domainName } });
    res.status(201).json(created);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create domain' });
  }
});

router.put('/domains/:id', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { domainName } = req.body as { domainName?: string };
    const existing = await prisma.competencyDomain.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Domain not found' });
    if (existing.organizationId !== req.user!.organizationId) return res.status(403).json({ error: 'Forbidden' });
    const updated = await prisma.competencyDomain.update({ where: { id }, data: { domainName } });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update domain' });
  }
});

router.delete('/domains/:id', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.competencyDomain.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Domain not found' });
    if (existing.organizationId !== req.user!.organizationId) return res.status(403).json({ error: 'Forbidden' });
    await prisma.competencyDomain.delete({ where: { id } });
    res.json({ success: true });
  } catch (e: any) {
    console.error(e);
    if (e?.code === 'P2003') return res.status(409).json({ error: 'This domain still has categories. Move or delete those categories before deleting the domain.' });
    res.status(500).json({ error: 'Failed to delete domain' });
  }
});

// Categories
router.get('/categories', authMiddleware, async (req: Request, res: Response) => {
  try {
    const categories = await prisma.competencyCategory.findMany({ where: { organizationId: req.user!.organizationId }, include: { domain: true } });
    res.json(categories);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list categories' });
  }
});

router.post('/categories', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { name, domainId } = req.body as { name: string; domainId: string };
    // Validate domain belongs to org
    const domain = await prisma.competencyDomain.findUnique({ where: { id: domainId } });
    if (!domain) return res.status(404).json({ error: 'Domain not found' });
    if (domain.organizationId !== req.user!.organizationId) return res.status(403).json({ error: 'Forbidden' });

    const created = await prisma.competencyCategory.create({ data: { organizationId: req.user!.organizationId, name, domainId } });
    res.status(201).json(created);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/categories/:id', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, domainId } = req.body as { name?: string; domainId?: string };

    const existing = await prisma.competencyCategory.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Category not found' });
    if (existing.organizationId !== req.user!.organizationId) return res.status(403).json({ error: 'Forbidden' });

    let updateData: any = { name };
    if (domainId) {
      const newDomain = await prisma.competencyDomain.findUnique({ where: { id: domainId } });
      if (!newDomain) return res.status(404).json({ error: 'Domain not found' });
      if (newDomain.organizationId !== req.user!.organizationId) return res.status(403).json({ error: 'Forbidden' });
      updateData.domainId = domainId;
    }

    const updated = await prisma.competencyCategory.update({ where: { id }, data: updateData });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.competencyCategory.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Category not found' });
    if (existing.organizationId !== req.user!.organizationId) return res.status(403).json({ error: 'Forbidden' });
    await prisma.competencyCategory.delete({ where: { id } });
    res.json({ success: true });
  } catch (e: any) {
    console.error(e);
    if (e?.code === 'P2003') return res.status(409).json({ error: 'This category still has competencies. Move or delete those competencies before deleting the category.' });
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Competencies
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const competencies = await prisma.competency.findMany({ where: { organizationId: req.user!.organizationId }, include: { category: { include: { domain: true } } } });
    res.json(competencies);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list competencies' });
  }
});

router.post('/', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { name, description, categoryId } = req.body as { name: string; description?: string; categoryId: string };
    const cat = await prisma.competencyCategory.findUnique({ where: { id: categoryId } });
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    if (cat.organizationId !== req.user!.organizationId) return res.status(403).json({ error: 'Forbidden' });

    const created = await prisma.competency.create({ data: { organizationId: req.user!.organizationId, name, description, categoryId } });
    res.status(201).json(created);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create competency' });
  }
});

router.put('/:id', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, categoryId } = req.body as { name?: string; description?: string; categoryId?: string };

    const existing = await prisma.competency.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Competency not found' });
    if (existing.organizationId !== req.user!.organizationId) return res.status(403).json({ error: 'Forbidden' });

    let updateData: any = { name, description };
    if (categoryId) {
      const category = await prisma.competencyCategory.findUnique({ where: { id: categoryId } });
      if (!category) return res.status(404).json({ error: 'Category not found' });
      if (category.organizationId !== req.user!.organizationId) return res.status(403).json({ error: 'Forbidden' });
      updateData.categoryId = categoryId;
    }

    const updated = await prisma.competency.update({ where: { id }, data: updateData });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update competency' });
  }
});

router.delete('/:id', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.competency.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Competency not found' });
    if (existing.organizationId !== req.user!.organizationId) return res.status(403).json({ error: 'Forbidden' });
    await prisma.competency.delete({ where: { id } });
    res.json({ success: true });
  } catch (e: any) {
    console.error(e);
    if (e?.code === 'P2003') return res.status(409).json({ error: 'This competency is used by job profiles or assessments and cannot be deleted.' });
    res.status(500).json({ error: 'Failed to delete competency' });
  }
});

// Proficiency levels
router.get('/levels', authMiddleware, async (req: Request, res: Response) => {
  try {
    const levels = await prisma.proficiencyLevel.findMany({ where: { organizationId: req.user!.organizationId }, orderBy: { levelNumber: 'asc' } });
    res.json(levels);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list levels' });
  }
});

router.post('/levels', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { levelNumber, label, description } = req.body as { levelNumber: number; label: string; description?: string };
    if (!Number.isInteger(levelNumber) || levelNumber < 1 || !label?.trim()) return res.status(400).json({ error: 'A positive whole level number and label are required.' });
    const created = await prisma.proficiencyLevel.create({ data: { organizationId: req.user!.organizationId, levelNumber, label, description } });
    res.status(201).json(created);
  } catch (e: any) {
    console.error(e);
    if (e?.code === 'P2002') return res.status(409).json({ error: 'That proficiency level number already exists in this organisation.' });
    res.status(500).json({ error: 'Failed to create level' });
  }
});

router.put('/levels/:id', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { levelNumber, label, description } = req.body as { levelNumber?: number; label?: string; description?: string };
    const existing = await prisma.proficiencyLevel.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Level not found' });
    if (existing.organizationId !== req.user!.organizationId) return res.status(403).json({ error: 'Forbidden' });
    if (levelNumber !== undefined && (!Number.isInteger(levelNumber) || levelNumber < 1)) return res.status(400).json({ error: 'Level number must be a positive whole number.' });
    if (label !== undefined && !label.trim()) return res.status(400).json({ error: 'A proficiency label is required.' });
    if (levelNumber !== undefined && levelNumber !== existing.levelNumber) {
      const [jobUsage, ratingUsage] = await Promise.all([
        prisma.jobCompetency.count({ where: { organizationId: req.user!.organizationId, requiredLevel: existing.levelNumber } }),
        prisma.assessmentRating.count({ where: { organizationId: req.user!.organizationId, rating: existing.levelNumber } })
      ]);
      if (jobUsage || ratingUsage) return res.status(409).json({ error: 'This level number is already used by job profiles or assessments. Change the label or description instead.' });
    }
    const updated = await prisma.proficiencyLevel.update({ where: { id }, data: { levelNumber, label, description } });
    res.json(updated);
  } catch (e: any) {
    console.error(e);
    if (e?.code === 'P2002') return res.status(409).json({ error: 'That proficiency level number already exists in this organisation.' });
    res.status(500).json({ error: 'Failed to update level' });
  }
});

router.delete('/levels/:id', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.proficiencyLevel.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Level not found' });
    if (existing.organizationId !== req.user!.organizationId) return res.status(403).json({ error: 'Forbidden' });
    const usedByJobProfile = await prisma.jobCompetency.count({ where: { organizationId: req.user!.organizationId, requiredLevel: existing.levelNumber } });
    if (usedByJobProfile > 0) return res.status(409).json({ error: 'This proficiency level is used in job profiles. Update those requirements before deleting it.' });
    const usedByAssessment = await prisma.assessmentRating.count({ where: { organizationId: req.user!.organizationId, rating: existing.levelNumber } });
    if (usedByAssessment > 0) return res.status(409).json({ error: 'This proficiency level is used in saved assessments and cannot be deleted.' });
    await prisma.proficiencyLevel.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete level' });
  }
});

export default router;
