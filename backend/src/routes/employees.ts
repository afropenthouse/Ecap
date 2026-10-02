import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authMiddleware, rbac } from '../middleware/auth';
import { generateToken, hashToken } from '../utils/tokens';
import { sendMail, buildVerifyEmail } from '../utils/email';

const router = Router();

// List employees with department info
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        organizationId: req.user!.organizationId,
        role: req.user!.role === 'HR' ? { in: ['EMPLOYEE', 'ASSESSOR'] } : 'EMPLOYEE',
      },
      include: {
        jobAssignments: {
          include: {
            job: {
              include: {
                department: true,
              },
            },
          },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    const employees = users.map((u) => {
      // Extract unique departments from job assignments
      const departmentMap = new Map<string, { id: string; name: string }>();
      u.jobAssignments.forEach((assignment) => {
        const dept = assignment.job.department as { id: string; name: string } | null;
        if (dept && !departmentMap.has(dept.id)) {
          departmentMap.set(dept.id, dept);
        }
      });

      const departments = Array.from(departmentMap.values());

      return {
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone || null,
        profilePictureUrl: u.profilePictureUrl || null,
        isLockedUntil: u.isLockedUntil || null,
        role: u.role,
        isActive: u.isActive,
        departmentIds: departments.map((d) => d.id),
        departments: departments.map((d) => ({ id: d.id, name: d.name })),
      };
    });

    res.json(employees);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list employees' });
  }
});

// Create employee (HR only) without department assignment
router.post('/', authMiddleware, rbac(['HR']), async (req: Request, res: Response) => {
  try {
    const { email, firstName, lastName, phone, profilePictureUrl } = req.body as {
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
      profilePictureUrl?: string;
    };

    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'email, firstName, lastName are required' });
    }

    // Create with a random initial password and send verification email
    const rawPwd = generateToken(18);
    const { hashPassword } = await import('../utils/password');
    const hashed = await hashPassword(rawPwd);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          organizationId: req.user!.organizationId,
          email,
          passwordHash: hashed,
          firstName,
          lastName,
          phone,
          profilePictureUrl,
          role: 'EMPLOYEE',
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'An account with this email already exists in the organization' });
      }
      throw err;
    }

    // Send email verification (best-effort)
    try {
      const rawToken = generateToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.emailVerificationToken.create({
        data: {
          organizationId: req.user!.organizationId,
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });
      const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } });
      const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://ecap-project.vercel.app' : 'http://localhost:5173');
      const verifyLink = `${frontendUrl}/auth/email-confirmation?token=${rawToken}`;
      const verifyTpl = buildVerifyEmail(org?.name || 'HRM Office', verifyLink);
      // Fire-and-forget the verification email so an SMTP outage doesn't delay the response
      void sendMail(user.email, verifyTpl.subject, verifyTpl.html, verifyTpl.text).catch((mailErr) => {
        console.error('[mailer] failed to send verification email (employee create):', mailErr);
      });
    } catch (mailErr) {
      console.error('[mailer] failed to send verification email:', mailErr);
    }

    return res.status(201).json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || null,
      profilePictureUrl: user.profilePictureUrl || null,
      isLockedUntil: user.isLockedUntil || null,
      // Maintain shape compatibility for frontend until UI is updated
      departmentIds: [],
      departments: [],
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// Update employee departments (HR only) — left intact for other pages
router.put('/:id/departments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { departmentIds } = req.body as { departmentIds: string[] };
    if (!Array.isArray(departmentIds)) return res.status(400).json({ error: 'departmentIds must be an array' });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.organizationId !== req.user!.organizationId || user.role !== 'EMPLOYEE') {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Employees may update their own department selections at any time.
    if (req.user!.role === 'EMPLOYEE') {
      if (req.user!.id !== id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    // Validate incoming departments belong to org
    const validDeps = await prisma.department.findMany({ where: { id: { in: departmentIds }, organizationId: req.user!.organizationId } });
    const newDepIds = new Set(validDeps.map((d) => d.id));

    // Get current assignments and their departments
    const currentAssignments = await prisma.employeeJobAssignment.findMany({
      where: { organizationId: req.user!.organizationId, employeeId: id },
      include: { job: true },
    });
    const currentDepIds = new Set(currentAssignments.map((a) => a.job.departmentId).filter((x): x is string => !!x));

    // Remove assignments for departments not in new set
    for (const a of currentAssignments) {
      const depId = a.job.departmentId;
      if (depId && !newDepIds.has(depId)) {
        await prisma.employeeJobAssignment.delete({ where: { id: a.id } });
      }
    }

    // Add assignments for new departments (one per department)
    for (const depId of newDepIds) {
      if (!currentDepIds.has(depId)) {
        let job = await prisma.job.findFirst({ where: { organizationId: req.user!.organizationId, departmentId: depId } });
        if (!job) {
          job = await prisma.job.create({
            data: {
              organizationId: req.user!.organizationId,
              departmentId: depId,
              title: 'General',
              description: 'Auto-created for department assignment',
            },
          });
        }
        await prisma.employeeJobAssignment.create({
          data: {
            organizationId: req.user!.organizationId,
            employeeId: id,
            jobId: job.id,
          },
        });
      }
    }

    const assignments = await prisma.employeeJobAssignment.findMany({
      where: { organizationId: req.user!.organizationId, employeeId: id },
      include: { job: { include: { department: true } } },
    });
    const deps = assignments
      .map((a) => a.job.department)
      .filter((d): d is { id: string; organizationId: string; name: string; createdAt: Date; updatedAt: Date } => !!d);
    const uniqueMap = new Map<string, { id: string; organizationId: string; name: string; createdAt: Date; updatedAt: Date }>();
    deps.forEach((d) => uniqueMap.set(d.id, d));

    // If the employee did the update, mark onboarding complete when applicable.
    let updatedLock: Date | null = user.isLockedUntil ?? null;
    let onboardingCompleted = !!user.onboardingCompleted;
    if (req.user!.role === 'EMPLOYEE') {
      if (user.onboardingCompleted) {
        updatedLock = user.isLockedUntil ?? null;
      } else {
        const updatedUser = await prisma.user.update({
          where: { id },
          data: { onboardingCompleted: true, isLockedUntil: null },
        });
        updatedLock = updatedUser.isLockedUntil ?? null;
        onboardingCompleted = !!updatedUser.onboardingCompleted;
      }
    }

    return res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || null,
      profilePictureUrl: user.profilePictureUrl || null,
      isLockedUntil: updatedLock,
      onboardingCompleted,
      departmentIds: Array.from(uniqueMap.keys()),
      departments: Array.from(uniqueMap.values()),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update employee departments' });
  }
});

export default router;
