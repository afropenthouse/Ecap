import { prisma } from '../config/prisma';
import { buildTalentInsights } from './talentInsights';

export function talentPeriod(fromValue?: unknown, toValue?: unknown) {
  const parse = (value: unknown, end: boolean, fallback: Date) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose a valid date range.');
    const result = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z`);
    if (!Number.isFinite(+result) || result.toISOString().slice(0, 10) !== value) throw new Error('Choose a valid date range.');
    return result;
  };
  const from = parse(fromValue, false, new Date(Date.now() - 365 * 86400000));
  const to = parse(toValue, true, new Date());
  if (from > to) throw new Error('Choose a valid date range.');
  return { from, to };
}

export async function loadTalentReport(organizationId: string, from: Date, to: Date, includeAssessors = false) {
  const [employees, jobs, assignments, assessments, appraisals, levels, assessorAssignments] = await Promise.all([
    prisma.user.findMany({ where: { organizationId, role: includeAssessors ? { in: ['EMPLOYEE', 'ASSESSOR'] } : 'EMPLOYEE', isActive: true }, select: { id: true, firstName: true, lastName: true, email: true, role: true } }),
    prisma.job.findMany({ where: { organizationId }, include: { department: true, requirements: { include: { competency: true } } } }),
    prisma.employeeJobAssignment.findMany({ where: { organizationId, OR: [{ startDate: null }, { startDate: { lte: new Date() } }] }, select: { employeeId: true, jobId: true } }),
    prisma.assessment.findMany({ where: { organizationId, status: { in: ['COMPLETED', 'REVIEWED'] }, OR: [{ completedAt: { gte: from, lte: to } }, { completedAt: null, createdAt: { gte: from, lte: to } }] }, include: { ratings: { include: { competency: { select: { name: true } } } } } }),
    prisma.performanceAppraisal.findMany({ where: { organizationId, status: { in: ['COMPLETED', 'REVIEWED'] }, OR: [{ completedAt: { gte: from, lte: to } }, { completedAt: null, createdAt: { gte: from, lte: to } }] }, include: { responses: { include: { question: { select: { title: true, key: true } } } } } }),
    prisma.proficiencyLevel.findMany({ where: { organizationId }, select: { levelNumber: true } }),
    includeAssessors ? prisma.assessorAssignment.findMany({ where: { organizationId }, select: { assessorId: true, employeeId: true } }) : Promise.resolve([]),
  ]);
  return buildTalentInsights({ employees, jobs, assignments, assessments, appraisals, assessorAssignments, maxLevel: Math.max(1, ...levels.map(l => l.levelNumber), ...(levels.length ? [] : [5])), from, to });
}
