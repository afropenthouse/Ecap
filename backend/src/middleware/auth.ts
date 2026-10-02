import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';

export type AuthUser = {
  id: string;
  organizationId: string;
  role: 'EMPLOYEE' | 'ASSESSOR' | 'HR';
};

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'Missing Authorization header' });

    const token = header.replace('Bearer ', '');
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'JWT secret not configured' });

    const decoded = jwt.verify(token, secret) as AuthUser & { iat: number; exp: number };
    const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { isActive: true, organizationId: true, role: true } });
    if (!user || user.organizationId !== decoded.organizationId) return res.status(401).json({ error: 'Invalid or expired token' });
    if (!user.isActive) return res.status(403).json({ error: 'Your account is deactivated. Contact your HR administrator.' });
    req.user = {
      id: decoded.id,
      organizationId: user.organizationId,
      role: user.role,
    };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const rbac = (roles: AuthUser['role'][]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
};
