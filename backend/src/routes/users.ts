import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authMiddleware, rbac } from '../middleware/auth';

const router = Router();

// List users in org (HR & Assessor)
router.get('/', authMiddleware, rbac(['HR', 'ASSESSOR']), async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user!.organizationId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, emailVerifiedAt: true, invitations: { select: { acceptedAt: true, expiresAt: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { firstName: 'asc' },
    });
    res.json(users.map(({ invitations, emailVerifiedAt, ...user }) => {
      const invitation = invitations[0];
      return { ...user, accountStatus: !user.isActive ? 'DEACTIVATED' : invitation ? (invitation.acceptedAt ? 'ACTIVE' : (invitation.expiresAt <= new Date() ? 'EXPIRED' : 'PENDING')) : (emailVerifiedAt ? 'ACTIVE' : 'PENDING') };
    }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// HR can suspend or restore an account within their own organization.
router.patch('/:id/activation', authMiddleware, rbac(['HR']), async (req: Request, res: Response) => {
  try {
    const { isActive } = req.body as { isActive?: boolean };
    if (typeof isActive !== 'boolean') return res.status(400).json({ error: 'isActive must be true or false' });
    if (req.params.id === req.user!.id && !isActive) return res.status(400).json({ error: 'You cannot deactivate your own account' });
    const user = await prisma.user.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const updated = await prisma.user.update({ where: { id: user.id }, data: { isActive } });
    return res.json({ id: updated.id, isActive: updated.isActive });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not update account status' });
  }
});

// Get user by id (HR & Assessor & employee self)
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.organizationId !== req.user!.organizationId) return res.status(404).json({ error: 'User not found' });
    if (req.user!.role === 'EMPLOYEE' && req.user!.id !== id) return res.status(403).json({ error: 'Forbidden' });
    let departments: Array<{ id: string; name: string }> = [];
    if (user.role === 'ASSESSOR') {
      const assessorDepartments = await prisma.assessorDepartment.findMany({
        where: { organizationId: user.organizationId, assessorId: user.id },
        include: { department: { select: { id: true, name: true } } },
      });
      departments = assessorDepartments.map(({ department }) => department);
    }

    res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, phone: user.phone || null, profilePictureUrl: user.profilePictureUrl || null, isLockedUntil: user.isLockedUntil || null, onboardingCompleted: !!user.onboardingCompleted, departments });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Users can update their own profile. HR may update their own account, but not
// another team member's profile.
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, profilePictureUrl, departmentIds } = req.body as { firstName?: string; lastName?: string; phone?: string; profilePictureUrl?: string; departmentIds?: string[] };
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.organizationId !== req.user!.organizationId) return res.status(404).json({ error: 'User not found' });

    if (req.user!.role === 'HR' && req.user!.id === id) {
      const updated = await prisma.user.update({ where: { id }, data: { firstName, lastName, phone, profilePictureUrl } });
      return res.json({ id: updated.id });
    }

    if (req.user!.role === 'HR') return res.status(403).json({ error: 'You cannot edit another team member’s profile' });

    if (req.user!.role === 'EMPLOYEE' || req.user!.role === 'ASSESSOR') {
      if (req.user!.id !== id) return res.status(403).json({ error: 'Forbidden' });
      if (departmentIds !== undefined && (!Array.isArray(departmentIds) || departmentIds.some((departmentId) => typeof departmentId !== 'string'))) {
        return res.status(400).json({ error: 'departmentIds must be an array of department IDs' });
      }
      // Employees and assessors may update their own profile at any time.
      if (!user.onboardingCompleted) {
        if (user.role === 'ASSESSOR' && departmentIds !== undefined) {
          const validDepartments = await prisma.department.findMany({ where: { id: { in: departmentIds }, organizationId: user.organizationId }, select: { id: true } });
          if (validDepartments.length !== new Set(departmentIds).size) return res.status(400).json({ error: 'Select departments from your organization' });
        }
        const updated = await prisma.$transaction(async (tx) => {
          const savedUser = await tx.user.update({ where: { id }, data: { firstName, lastName, phone, profilePictureUrl } });
          if (user.role === 'ASSESSOR' && departmentIds !== undefined) {
            await tx.assessorDepartment.deleteMany({ where: { assessorId: id, organizationId: user.organizationId } });
            if (departmentIds.length) await tx.assessorDepartment.createMany({ data: [...new Set(departmentIds)].map((departmentId) => ({ assessorId: id, departmentId, organizationId: user.organizationId })) });
          }
          return savedUser;
        });
        return res.json({ id: updated.id });
      }
      if (user.role === 'ASSESSOR' && departmentIds !== undefined) {
        const validDepartments = await prisma.department.findMany({ where: { id: { in: departmentIds }, organizationId: user.organizationId }, select: { id: true } });
        if (validDepartments.length !== new Set(departmentIds).size) return res.status(400).json({ error: 'Select departments from your organization' });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const savedUser = await tx.user.update({
          where: { id },
          data: { firstName, lastName, phone, profilePictureUrl },
        });
        if (user.role === 'ASSESSOR' && departmentIds !== undefined) {
          await tx.assessorDepartment.deleteMany({ where: { assessorId: id, organizationId: user.organizationId } });
          if (departmentIds.length) await tx.assessorDepartment.createMany({ data: [...new Set(departmentIds)].map((departmentId) => ({ assessorId: id, departmentId, organizationId: user.organizationId })) });
        }
        return savedUser;
      });
      return res.json({ id: updated.id });
    }

    return res.status(403).json({ error: 'Forbidden' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (HR only)
router.delete('/:id', authMiddleware, rbac(['HR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.organizationId !== req.user!.organizationId) return res.status(404).json({ error: 'User not found' });
    if (user.id === req.user!.id) return res.status(400).json({ error: 'You cannot delete your own account' });
    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    if ((e as { code?: string })?.code === 'P2003') return res.status(409).json({ error: 'This user has linked records. Deactivate the account to preserve its history.' });
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
