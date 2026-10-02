import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authMiddleware, rbac } from '../middleware/auth';
import { hashPassword } from '../utils/password';
import { generateToken, hashToken } from '../utils/tokens';
import { sendMail, buildInvitationEmail } from '../utils/email';

const router = Router();

// Public list of organizations for login dropdown
router.get('/public', async (_req: Request, res: Response) => {
  try {
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, logoUrl: true },
      orderBy: { name: 'asc' },
    });
    res.json(orgs);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list organizations' });
  }
});

// Get my organization info (HR & Assessor & Employee)
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } });
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    res.json({ id: org.id, name: org.name, email: org.email, logoUrl: org.logoUrl, address: org.address });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// Update organization settings (HR only)
router.put('/me', authMiddleware, rbac(['HR']), async (req: Request, res: Response) => {
  try {
    const { name, email, logoUrl, address } = req.body as { name?: string; email?: string; logoUrl?: string; address?: string };
    const org = await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data: { name, email, logoUrl, address },
    });
    res.json({ id: org.id, name: org.name, email: org.email, logoUrl: org.logoUrl, address: org.address });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// HR admins can invite users to their own organization only.
router.post('/me/invitations', authMiddleware, rbac(['HR']), async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, role } = req.body as { firstName?: string; lastName?: string; email?: string; role?: string };
    const normalizedEmail = email?.trim().toLowerCase();
    if (!firstName?.trim() || !lastName?.trim() || !normalizedEmail || !['EMPLOYEE', 'ASSESSOR', 'HR'].includes(role || '')) {
      return res.status(400).json({ error: 'Full name, work email, and a valid role are required' });
    }

    const existing = await prisma.user.findUnique({ where: { organizationId_email: { organizationId: req.user!.organizationId, email: normalizedEmail } } });
    if (existing) return res.status(409).json({ error: 'A team member with this email already exists' });

    const organization = await prisma.organization.findUnique({ where: { id: req.user!.organizationId }, select: { name: true } });
    if (!organization) return res.status(404).json({ error: 'Organization not found' });

    const temporaryPassword = generateToken(18);
    const user = await prisma.user.create({ data: {
      organizationId: req.user!.organizationId,
      email: normalizedEmail,
      passwordHash: await hashPassword(temporaryPassword),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: role as 'EMPLOYEE' | 'ASSESSOR' | 'HR',
    } });
    const token = generateToken(32);
    await prisma.userInvitation.create({ data: {
      organizationId: req.user!.organizationId,
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    } });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const loginLink = `${frontendUrl}/auth/login?organizationId=${encodeURIComponent(req.user!.organizationId)}`;
    const invitationEmail = buildInvitationEmail(organization.name, user.firstName, user.role, temporaryPassword, loginLink);
    void sendMail(user.email, invitationEmail.subject, invitationEmail.html, invitationEmail.text).catch((error) => console.error('[mailer] invitation send failed:', error));
    return res.status(201).json({ id: user.id, email: user.email, role: user.role, invitationSent: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to invite team member' });
  }
});

export default router;
