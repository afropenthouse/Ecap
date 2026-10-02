import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { hashPassword, verifyPassword, isStrongPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { authMiddleware } from '../middleware/auth';
import { sendMail, buildWelcomeEmail, buildResetEmail, buildVerifyCodeEmail } from '../utils/email';
import { generateToken, generateVerificationCode, hashToken } from '../utils/tokens';

const router = Router();
const emailCodeAttempts = new Map<string, { count: number; resetAt: number }>();
const emailCodeResends = new Map<string, { count: number; resetAt: number; sentAt: number }>();

// Lightweight connectivity ping for diagnostics
router.get('/ping', async (_req: Request, res: Response) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// Organization signup + create HR admin user
router.post('/org/signup', async (req: Request, res: Response) => {
  try {
    const { organizationName, organizationEmail, adminEmail, adminPassword, logoUrl, address, firstName, lastName } = req.body as {
      organizationName: string;
      organizationEmail: string;
      adminEmail: string;
      adminPassword: string;
      firstName?: string;
      lastName?: string;
      logoUrl?: string;
      address?: string;
    };

    if (!organizationName || !organizationEmail || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!isStrongPassword(adminPassword)) {
      return res.status(400).json({ error: 'Password must have at least 8 characters, upper and lowercase letters, a number, and a symbol.' });
    }

    const passwordHash = await hashPassword(adminPassword);
    const { org, admin } = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: organizationName.trim(), email: organizationEmail.trim().toLowerCase(), logoUrl, address },
      });
      const admin = await tx.user.create({
        data: {
          organizationId: org.id,
          email: adminEmail.trim().toLowerCase(),
          passwordHash,
          firstName: firstName?.trim() || organizationName.trim(),
          lastName: lastName?.trim() || '',
          role: 'HR',
        },
      });
      return { org, admin };
    });

    // Send an expiring, one-time verification code to the HR administrator.
    const verificationCode = generateVerificationCode();
    const tokenHash = hashToken(`${admin.email}:${verificationCode}`);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.emailVerificationToken.create({
      data: {
        organizationId: org.id,
        userId: admin.id,
        tokenHash,
        expiresAt,
      },
    });

    const verifyTpl = buildVerifyCodeEmail(org.name, verificationCode);
    // Send email verification asynchronously to avoid blocking the signup response
    void sendMail(admin.email, verifyTpl.subject, verifyTpl.html, verifyTpl.text).catch((e) => {
      console.error('[mailer] failed to send verification email:', e);
    });

    // Send welcome email to admin
    const welcome = buildWelcomeEmail(org.name);
    // Send welcome email asynchronously
    void sendMail(admin.email, welcome.subject, welcome.html, welcome.text).catch((e) => {
      console.error('[mailer] failed to send welcome email:', e);
    });

    return res.status(201).json({
      user: { id: admin.id, email: admin.email, role: admin.role, organizationId: org.id },
      organization: { id: org.id, name: org.name, logoUrl: org.logoUrl },
      emailVerificationRequired: true,
      verificationCodeExpiresInMinutes: 15,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to create organization' });
  }
});

// HR creates users (employee or assessor)
router.post('/signup', authMiddleware, async (_req: Request, res: Response) => {
  return res.status(410).json({ error: 'Use the HR team invitation flow to create organization users.' });
});

// Individual self-signup (public)
router.post('/individual/signup', async (req: Request, res: Response) => {
  return res.status(410).json({ error: 'Public team signup is closed. Ask your HR administrator for an invitation.' });
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email: inputEmail, password, organizationId } = req.body as { email: string; password: string; organizationId?: string };
    const email = inputEmail?.trim().toLowerCase();
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const candidates = await prisma.user.findMany({
      where: { email, ...(organizationId ? { organizationId } : {}) },
      include: { organization: true },
    });
    const matches = [];
    for (const candidate of candidates) if (await verifyPassword(password, candidate.passwordHash)) matches.push(candidate);
    if (matches.length !== 1) return res.status(401).json({ error: 'Invalid credentials' });
    const user = matches[0];
    const org = user.organization;
    if (!user.isActive) return res.status(403).json({ error: 'Your account is deactivated. Contact your HR administrator.' });

    const pendingInvitation = await prisma.userInvitation.findFirst({
      where: { userId: user.id, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (pendingInvitation) return res.status(403).json({ error: 'PASSWORD_CHANGE_REQUIRED' });

    // Enforce email verification before login
    if (!user.emailVerifiedAt) {
      return res.status(403).json({ error: 'Email not verified. Please check your inbox for the verification link.' });
    }

    const token = signToken({ id: user.id, organizationId: org.id, role: user.role });
    return res.json({ token, user: { id: user.id, email: user.email, role: user.role, organizationId: org.id, firstName: user.firstName, lastName: user.lastName }, organization: { id: org.id, name: org.name, logoUrl: org.logoUrl } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ id: user.id, email: user.email, role: user.role, organizationId: user.organizationId, firstName: user.firstName, lastName: user.lastName });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email: string };
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const users = await prisma.user.findMany({ where: { email: email.trim().toLowerCase() }, include: { organization: true } });

    // Always respond success; only proceed if user exists
    for (const user of users) {
      const rawToken = generateToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.passwordResetToken.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://ecap-project.vercel.app' : 'http://localhost:5173');
      const link = `${frontendUrl}/auth/reset-password?token=${rawToken}`;
      const emailTpl = buildResetEmail(user.organization.name, link);
    // Asynchronous reset email send
    void sendMail(user.email, emailTpl.subject, emailTpl.html, emailTpl.text).catch((e) => {
      console.error('[mailer] failed to send password reset email:', e);
    });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ success: true }); // still mask errors
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body as { token: string; password: string };
    if (!token || !password) return res.status(400).json({ error: 'Missing required fields' });

    const tokenHash = hashToken(token);
    const record = await prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) return res.status(400).json({ error: 'Invalid or expired token' });

    const passwordHash = await hashPassword(password);
    await prisma.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });

    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Resend email verification
router.post('/verify-email/resend', async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email: string };
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const normalizedEmail = email.trim().toLowerCase();
    const resendWindow = emailCodeResends.get(normalizedEmail);
    const resendNow = Date.now();
    if (resendWindow && resendWindow.resetAt > resendNow && (resendWindow.count >= 3 || resendNow - resendWindow.sentAt < 60_000)) {
      return res.status(429).json({ error: 'Please wait before requesting another verification code.' });
    }
    emailCodeResends.set(normalizedEmail, resendWindow && resendWindow.resetAt > resendNow
      ? { count: resendWindow.count + 1, resetAt: resendWindow.resetAt, sentAt: resendNow }
      : { count: 1, resetAt: resendNow + 60 * 60 * 1000, sentAt: resendNow });
    const users = await prisma.user.findMany({ where: { email: normalizedEmail, emailVerifiedAt: null }, include: { organization: true } });
    for (const user of users) {
      const code = generateVerificationCode();
      await prisma.emailVerificationToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
      await prisma.emailVerificationToken.create({ data: { organizationId: user.organizationId, userId: user.id, tokenHash: hashToken(`${user.email}:${code}`), expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
      const verifyTpl = buildVerifyCodeEmail(user.organization.name, code);
      void sendMail(user.email, verifyTpl.subject, verifyTpl.html, verifyTpl.text).catch((e) => console.error('[mailer] failed to resend verification code:', e));
    }

    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ success: true });
  }
});

// Verify email
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body as { token: string };
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const tokenHash = hashToken(token);
    const rec = await prisma.emailVerificationToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!rec) return res.status(400).json({ error: 'Invalid or expired token' });

    const user = await prisma.user.findUnique({ where: { id: rec.userId }, select: { role: true } });
    await prisma.user.update({ where: { id: rec.userId }, data: { emailVerifiedAt: new Date(), onboardingCompleted: user?.role === 'HR' ? true : undefined } });
    await prisma.emailVerificationToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } });

    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to verify email' });
  }
});

// Invitees prove possession of their emailed temporary password and replace it on first sign in.
router.post('/first-login', async (req: Request, res: Response) => {
  try {
    const { email: inputEmail, temporaryPassword, newPassword, organizationId } = req.body as { email?: string; temporaryPassword?: string; newPassword?: string; organizationId?: string };
    const email = inputEmail?.trim().toLowerCase();
    if (!email || !temporaryPassword || !newPassword) return res.status(400).json({ error: 'Email, temporary password, and new password are required' });
    if (!isStrongPassword(newPassword)) return res.status(400).json({ error: 'Password must have at least 8 characters, upper and lowercase letters, a number, and a symbol.' });
    const users = await prisma.user.findMany({ where: { email, ...(organizationId ? { organizationId } : {}) } });
    const matches = [];
    for (const candidate of users) if (await verifyPassword(temporaryPassword, candidate.passwordHash)) matches.push(candidate);
    if (matches.length !== 1) return res.status(401).json({ error: 'Temporary password is invalid or the invitation has expired' });
    const user = matches[0];
    if (!user.isActive) return res.status(403).json({ error: 'Your account is deactivated. Contact your HR administrator.' });
    const invitation = await prisma.userInvitation.findFirst({ where: { userId: user.id, acceptedAt: null, expiresAt: { gt: new Date() } } });
    if (!invitation) return res.status(400).json({ error: 'There is no pending invitation for this account' });
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword), emailVerifiedAt: new Date() } }),
      prisma.userInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    ]);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not activate account' });
  }
});

router.post('/verify-email-code', async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    if (!email || !/^\d{8}$/.test(code)) return res.status(400).json({ error: 'Enter the 8-digit code sent to your work email' });

    const nowMs = Date.now();
    for (const [key, attempts] of emailCodeAttempts) if (attempts.resetAt <= nowMs) emailCodeAttempts.delete(key);
    const attemptKey = `${req.ip}:${email}`;
    const current = emailCodeAttempts.get(attemptKey);
    if (current && current.resetAt > nowMs && current.count >= 8) return res.status(429).json({ error: 'Too many attempts. Request a new code and try again later.' });
    emailCodeAttempts.set(attemptKey, current && current.resetAt > nowMs ? { ...current, count: current.count + 1 } : { count: 1, resetAt: nowMs + 15 * 60 * 1000 });

    const record = await prisma.emailVerificationToken.findFirst({
      where: { tokenHash: hashToken(`${email}:${code}`), usedAt: null, expiresAt: { gt: new Date() }, user: { email } },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.user.emailVerifiedAt) return res.status(400).json({ error: 'That code is invalid or has expired. Request a new one and try again.' });
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date(), onboardingCompleted: record.user.role === 'HR' ? true : undefined } }),
      prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    emailCodeAttempts.delete(attemptKey);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not verify this code' });
  }
});

router.post('/accept-invite', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password || password.length < 8) return res.status(400).json({ error: 'Use a valid invitation and a password of at least 8 characters' });
    const invitation = await prisma.userInvitation.findFirst({
      where: { tokenHash: hashToken(token), acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!invitation) return res.status(400).json({ error: 'Invitation is invalid or expired' });
    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: invitation.userId }, data: { passwordHash, emailVerifiedAt: new Date() } }),
      prisma.userInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    ]);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

export default router;
