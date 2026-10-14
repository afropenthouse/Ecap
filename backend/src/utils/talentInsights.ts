import type { Prisma } from '@prisma/client';

type Employee = Prisma.UserGetPayload<{ select: { id: true; firstName: true; lastName: true; email: true } }> & { role?: 'EMPLOYEE' | 'ASSESSOR' | 'HR' };
type Job = Prisma.JobGetPayload<{ include: { department: true; requirements: { include: { competency: true } } } }>;
type Assessment = Omit<Prisma.AssessmentGetPayload<{ include: { ratings: true } }>, 'ratings'> & { ratings: Array<Prisma.AssessmentRatingGetPayload<{}> & { competency?: { name: string } }> };
type Appraisal = Omit<Prisma.PerformanceAppraisalGetPayload<{ include: { responses: true } }>, 'responses'> & { responses: Array<Prisma.PerformanceAppraisalResponseGetPayload<{}> & { question?: { title: string; key: string } }> };
type Assignment = { employeeId: string; jobId: string };
const round = (n: number) => Math.round(n * 100) / 100;
const mean = (values: number[]) => values.length ? round(values.reduce((sum, n) => sum + n, 0) / values.length) : null;
const date = (record: { completedAt: Date | null; createdAt: Date }) => record.completedAt ?? record.createdAt;
const final = (status: string) => status === 'COMPLETED' || status === 'REVIEWED';
export const generatedJob = { title: 'General', description: 'Auto-created for department assignment' };
// Explicit null branch preserves legitimate General roles without a description.
export const realJobFilter = { OR: [{ title: { not: generatedJob.title } }, { description: null }, { description: { not: generatedJob.description } }] };

export function correlation(pairs: Array<[number, number]>) {
  if (pairs.length < 3) return null;
  const x = pairs.reduce((sum, p) => sum + p[0], 0) / pairs.length;
  const y = pairs.reduce((sum, p) => sum + p[1], 0) / pairs.length;
  const numerator = pairs.reduce((sum, p) => sum + (p[0] - x) * (p[1] - y), 0);
  const denominator = Math.sqrt(pairs.reduce((sum, p) => sum + (p[0] - x) ** 2, 0) * pairs.reduce((sum, p) => sum + (p[1] - y) ** 2, 0));
  return denominator ? round(numerator / denominator) : null;
}

// Latest completed record per source; drafts and self ratings never establish role readiness.
function latest<T extends { type: string; assessorId: string | null; status: string; completedAt: Date | null; createdAt: Date }>(records: T[], type: string) {
  const sorted = records.filter(r => r.type === type && final(r.status)).sort((a, b) => +date(b) - +date(a));
  return sorted.filter((r, i) => sorted.findIndex(other => other.assessorId === r.assessorId) === i);
}

export function buildTalentInsights(input: {
  employees: Employee[]; jobs: Job[]; assignments: Assignment[]; assessments: Assessment[];
  appraisals: Appraisal[]; maxLevel: number; from: Date; to: Date; now?: Date;
  assessorAssignments?: Array<{ assessorId: string; employeeId: string }>;
}) {
  const now = input.now ?? new Date();
  const inWindow = (r: { completedAt: Date | null; createdAt: Date }) => date(r) >= input.from && date(r) <= input.to;
  const jobs = input.jobs.filter(j => !(j.title === generatedJob.title && j.description === generatedJob.description));
  const employees = input.employees.map(employee => {
    const role = employee.role ?? 'EMPLOYEE';
    const assessments = input.assessments.filter(a => a.employeeId === employee.id && inWindow(a));
    const appraisals = input.appraisals.filter(a => a.employeeId === employee.id && inWindow(a));
    const consensus = latest(assessments, 'CONSENSUS')[0];
    const assessors = latest(assessments, 'ASSESSOR');
    const newestAssessor = assessors.reduce((n, a) => Math.max(n, +date(a)), 0);
    const evidence = consensus && +date(consensus) >= newestAssessor ? [consensus] : assessors;
    const self = latest(assessments, 'SELF')[0];
    const performanceRecords = latest(appraisals, 'ASSESSOR');
    const selfAppraisal = latest(appraisals, 'SELF')[0];
    const ratings = new Map<string, number>();
    const competencyIds = new Set(evidence.flatMap(a => a.ratings.map(r => r.competencyId)));
    for (const id of competencyIds) {
      const values = evidence.flatMap(a => a.ratings.filter(r => r.competencyId === id).map(r => r.rating));
      const rating = mean(values);
      if (rating !== null) ratings.set(id, rating);
    }
    const competency = mean([...ratings.values()].map(r => Math.min(100, r / input.maxLevel * 100)));
    const performance = mean(performanceRecords.flatMap(a => a.responses.flatMap(r => r.assessorRating === null ? [] : [r.assessorRating / 5 * 100])));
    const selfCompetency = self ? mean(self.ratings.map(r => Math.min(100, r.rating / input.maxLevel * 100))) : null;
    const selfPerformance = selfAppraisal ? mean(selfAppraisal.responses.flatMap(r => r.employeeRating === null ? [] : [r.employeeRating / 5 * 100])) : null;
    const evidenceDates = [...evidence, ...performanceRecords].map(date);
    const aligned = evidence.length > 0 && performanceRecords.length > 0 && Math.max(...evidenceDates.map(Number)) - Math.min(...evidenceDates.map(Number)) <= 90 * 86400000;
    const fresh = evidenceDates.length > 0 && evidenceDates.every(d => +now - +d <= 365 * 86400000);
    const currentJobIds = input.assignments.filter(a => a.employeeId === employee.id).map(a => a.jobId);
    const roleMatches = jobs.map(job => {
      const gaps = job.requirements.map(r => {
        const currentLevel = ratings.get(r.competencyId) ?? null;
        return { competencyId: r.competencyId, competency: r.competency.name, requiredLevel: r.requiredLevel, currentLevel, gap: currentLevel === null ? null : round(Math.max(0, r.requiredLevel - currentLevel)) };
      });
      const assessed = gaps.filter(g => g.currentLevel !== null).length;
      const coverage = gaps.length ? round(assessed / gaps.length * 100) : 0;
      const fit = assessed ? round(gaps.reduce((sum, g) => sum + (g.currentLevel === null ? 0 : Math.min(1, g.currentLevel / g.requiredLevel)), 0) / gaps.length * 100) : null;
      let readiness = 'Insufficient evidence';
      if (gaps.length && coverage === 100 && performance !== null && aligned && fresh) {
        readiness = fit === 100 && performance >= 80 ? 'Ready for HR review' : fit !== null && fit >= 80 && performance >= 60 ? 'Needs development' : 'Development priority';
      }
      return { jobId: job.id, title: job.title, departmentId: job.departmentId, department: job.department?.name ?? 'No department', current: currentJobIds.includes(job.id), coverage, fit, readiness, gaps };
    }).sort((a, b) => (b.fit ?? -1) - (a.fit ?? -1));
    const recommendations: Array<{ kind: string; jobId: string | null; title: string; reason: string; actions: string[] }> = [];
    if (!evidence.length || performance === null || !aligned || !fresh) {
      recommendations.push({ kind: 'EVIDENCE', jobId: null, title: 'Complete or refresh assessment evidence', reason: !evidence.length ? 'No completed assessor or consensus competency assessment in this period.' : performance === null ? 'No completed assessor appraisal in this period.' : !aligned ? 'Competency and appraisal evidence are more than 90 days apart.' : 'Assessment evidence is older than 12 months.', actions: ['Complete competency assessment and assessor appraisal for the same review period.'] });
    }
    for (const role of roleMatches) {
      const missing = role.gaps.filter(g => g.currentLevel === null);
      const gaps = role.gaps.filter(g => g.gap !== null && g.gap > 0);
      if (role.current && (missing.length || gaps.length)) recommendations.push({ kind: 'TRAINING', jobId: role.jobId, title: `Development plan: ${role.title}`, reason: `${gaps.length} competency gaps; ${missing.length} competencies still need assessment.`, actions: [...gaps.map(g => `Training or mentoring in ${g.competency}: current ${g.currentLevel}, required ${g.requiredLevel}. Reassess after supervised practice.`), ...missing.map(g => `Assess ${g.competency} before selecting training.`)] });
      if (!role.current && ['Ready for HR review', 'Needs development'].includes(role.readiness)) recommendations.push({ kind: 'SUCCESSION', jobId: role.jobId, title: `${role.readiness}: ${role.title}`, reason: `${role.fit}% requirement match, ${role.coverage}% assessment coverage, ${performance}% assessor performance.`, actions: role.readiness === 'Ready for HR review' ? ['HR should verify experience, employee interest and role context before confirming succession or assigning responsibilities.'] : [...gaps.map(g => `Develop ${g.competency} from ${g.currentLevel} to ${g.requiredLevel}, then reassess for this role.`), ...(performance !== null && performance < 80 ? ['Agree performance goals and coaching; review progress before confirming role readiness.'] : [])] });
    }
    if (performance !== null && performance < 60 && aligned && fresh) recommendations.push({ kind: 'PERFORMANCE', jobId: null, title: 'Review performance barriers', reason: `Assessor performance is ${performance}%.`, actions: ['Discuss objectives, workload, resources and coaching needs with the employee and assessor.'] });
    if (aligned && fresh && performance !== null && performance >= 80 && roleMatches.some(r => r.current && r.readiness === 'Ready for HR review')) recommendations.push({ kind: 'RESPONSIBILITY', jobId: null, title: 'Consider a stretch assignment', reason: 'Strong assessor performance and all assessed current-role requirements met.', actions: ['Agree a supervised assignment and success measures with the employee; use target-role matches below for other responsibilities.'] });
    const history = assessments.filter(a => final(a.status)).map(a => ({ id: a.id, kind: `Competency / ${a.type}`, date: date(a).toISOString(), score: mean(a.ratings.map(r => Math.min(100, r.rating / input.maxLevel * 100))) })).concat(appraisals.filter(a => final(a.status)).map(a => ({ id: a.id, kind: `Appraisal / ${a.type}`, date: date(a).toISOString(), score: mean(a.responses.flatMap(r => { const rating = a.type === 'SELF' ? r.employeeRating : r.assessorRating; return rating === null ? [] : [rating / 5 * 100]; })) }))).sort((a, b) => b.date.localeCompare(a.date));
    const competencyRatings = [...ratings].map(([competencyId, currentLevel]) => ({ competencyId,
      name: evidence.flatMap(a => a.ratings).find(r => r.competencyId === competencyId)?.competency?.name ?? jobs.flatMap(j => j.requirements).find(r => r.competencyId === competencyId)?.competency.name ?? 'Assessed competency',
      currentLevel, selfLevel: self?.ratings.find(r => r.competencyId === competencyId)?.rating ?? null }));
    const questionIds = new Set(performanceRecords.flatMap(a => a.responses.map(r => r.questionId)));
    const performanceFactors = [...questionIds].map(questionId => ({ questionId,
      title: performanceRecords.flatMap(a => a.responses).find(r => r.questionId === questionId)?.question?.title ?? 'Appraisal factor',
      assessorScore: mean(performanceRecords.flatMap(a => a.responses.filter(r => r.questionId === questionId && r.assessorRating !== null).map(r => r.assessorRating! / 5 * 100))),
      selfScore: (selfAppraisal?.responses.find(r => r.questionId === questionId)?.employeeRating ?? null) === null ? null : selfAppraisal!.responses.find(r => r.questionId === questionId)!.employeeRating! / 5 * 100 }));
    const reviews = role === 'ASSESSOR' ? input.assessments.filter(a => a.assessorId === employee.id && a.type === 'ASSESSOR' && final(a.status) && inWindow(a)) : [];
    const performanceReviews = role === 'ASSESSOR' ? input.appraisals.filter(a => a.assessorId === employee.id && a.type === 'ASSESSOR' && final(a.status) && inWindow(a)) : [];
    const reviewedRatings = reviews.flatMap(review => review.ratings);
    const differences = reviews.flatMap(review => {
      const selfRecord = input.assessments.filter(a => a.employeeId === review.employeeId && a.type === 'SELF' && final(a.status) && a.createdAt <= review.createdAt).sort((a, b) => +b.createdAt - +a.createdAt)[0];
      return review.ratings.flatMap(rating => {
        const selfRating = selfRecord?.ratings.find(item => item.competencyId === rating.competencyId);
        return selfRating ? [Math.abs(selfRating.rating - rating.rating)] : [];
      });
    });
    const reviewDates = [...reviews, ...performanceReviews].map(date);
    const assessorActivity = role === 'ASSESSOR' ? {
      assignedEmployees: new Set((input.assessorAssignments || []).filter(a => a.assessorId === employee.id).map(a => a.employeeId)).size,
      competencyReviews: reviews.length, performanceReviews: performanceReviews.length,
      reviewedEmployees: new Set([...reviews, ...performanceReviews].map(a => a.employeeId)).size,
      commentedRatings: reviewedRatings.filter(r => r.comment?.trim()).length, totalRatings: reviewedRatings.length,
      meanSelfDifference: mean(differences), comparisonCount: differences.length,
      lastReviewAt: reviewDates.length ? new Date(Math.max(...reviewDates.map(Number))).toISOString() : null,
    } : null;
    const person = { ...employee, role, competency, performance, selfCompetency, selfPerformance, source: evidence[0]?.type ?? null, competencyDate: evidence.length ? new Date(Math.max(...evidence.map(a => +date(a)))).toISOString() : null, performanceDate: performanceRecords.length ? new Date(Math.max(...performanceRecords.map(a => +date(a)))).toISOString() : null, aligned, fresh, currentJobIds, roleMatches, recommendations, history, competencyRatings, performanceFactors, assessorActivity };
    return role === 'ASSESSOR' ? { ...person, competency: null, performance: null, selfCompetency: null, selfPerformance: null, source: null, competencyDate: null, performanceDate: null, aligned: false, fresh: false, currentJobIds: [] as typeof currentJobIds, roleMatches: [] as typeof roleMatches, recommendations: [] as typeof recommendations, history: [] as typeof history, competencyRatings: [] as typeof competencyRatings, performanceFactors: [] as typeof performanceFactors } : person;
  });
  const correlations = jobs.map(job => {
    const pairs: Array<[number, number]> = employees.filter(e => e.currentJobIds.includes(job.id) && e.aligned).flatMap(e => {
      const role = e.roleMatches.find(r => r.jobId === job.id);
      return role?.coverage === 100 && role.fit !== null && e.performance !== null ? [[role.fit, e.performance] as [number, number]] : [];
    });
    return { jobId: job.id, title: job.title, sampleSize: pairs.length, coefficient: correlation(pairs) };
  });
  return { from: input.from.toISOString(), to: input.to.toISOString(), generatedAt: now.toISOString(), employees, correlations,
    companyRoles: jobs.map(job => ({ jobId: job.id, title: job.title, departmentId: job.departmentId, department: job.department?.name ?? 'No department', requirementCount: job.requirements.length })),
    succession: jobs.map(job => ({ jobId: job.id, title: job.title, candidates: employees.flatMap(e => { const role = e.roleMatches.find(r => r.jobId === job.id); return role && !role.current && ['Ready for HR review', 'Needs development'].includes(role.readiness) ? [{ employeeId: e.id, name: `${e.firstName} ${e.lastName}`, fit: role.fit, performance: e.performance, readiness: role.readiness }] : []; }).sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0)) })) };
}
