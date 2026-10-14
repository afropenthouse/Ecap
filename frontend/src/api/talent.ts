import { api, apiFetch } from './client';

export interface RoleMatch {
  jobId: string; title: string; departmentId: string | null; department: string; current: boolean;
  coverage: number; fit: number | null; readiness: string;
  gaps: Array<{ competencyId: string; competency: string; requiredLevel: number; currentLevel: number | null; gap: number | null }>;
}
export interface TalentEmployee {
  id: string; firstName: string; lastName: string; email: string;
  role?: 'EMPLOYEE' | 'ASSESSOR' | 'HR';
  assessorActivity?: { assignedEmployees: number; competencyReviews: number; performanceReviews: number; reviewedEmployees: number; commentedRatings: number; totalRatings: number; meanSelfDifference: number | null; comparisonCount: number; lastReviewAt: string | null } | null;
  competency: number | null; performance: number | null; selfCompetency: number | null; selfPerformance: number | null;
  source: string | null; competencyDate: string | null; performanceDate: string | null; aligned: boolean; fresh: boolean;
  currentJobIds: string[]; roleMatches: RoleMatch[];
  recommendations: Array<{ kind: string; jobId: string | null; title: string; reason: string; actions: string[] }>;
  history: Array<{ id: string; kind: string; date: string; score: number | null }>;
  competencyRatings?: Array<{ competencyId: string; name: string; currentLevel: number; selfLevel: number | null }>;
  performanceFactors?: Array<{ questionId: string; title: string; assessorScore: number | null; selfScore: number | null }>;
}
export interface TalentReport {
  from: string; to: string; generatedAt: string; employees: TalentEmployee[];
  companyRoles?: Array<{ jobId: string; title: string; departmentId: string | null; department: string; requirementCount: number }>;
  correlations: Array<{ jobId: string; title: string; sampleSize: number; coefficient: number | null }>;
  succession: Array<{ jobId: string; title: string; candidates: Array<{ employeeId: string; name: string; fit: number | null; performance: number | null; readiness: string }> }>;
}
export const getTalentReport = (from: string, to: string, includeAssessors = false) => api.get<TalentReport>(`/talent?${new URLSearchParams({ from, to, ...(includeAssessors ? { includeAssessors: 'true' } : {}) })}`);

export type AIMode = 'recommendations' | 'succession' | 'reports';
export interface TalentAIResult {
  advice: {
    title: string; summary: string;
    findings: Array<{ category: string; employeeId: string | null; jobId: string | null; suggestedRole?: string | null; roleAvailability?: 'Listed in company' | 'Not listed in company'; title: string; explanation: string; evidenceIds: string[]; actions: string[] }>;
    sections: Array<{ heading: string; body: string; evidenceIds: string[] }>;
    nextSteps: string[]; limitations: string[];
  };
  evidence: Array<{ id: string; employeeId: string | null; jobId: string | null; fact: string }>;
  subjects: Array<{ id: string; label: string }>;
  model: string; generatedAt: string; cached: boolean;
}
export const getTalentAIStatus = () => api.get<{ configured: boolean; model: string }>('/talent/ai/status');
export const generateTalentAI = (body: { mode: AIMode; from: string; to: string; employeeId?: string; employeeIds?: string[]; departmentId?: string; jobId?: string; brief?: string; reportStyle?: 'executive' | 'detailed' | 'development' }) =>
  apiFetch<TalentAIResult>('/talent/ai', { method: 'POST', body, timeoutMs: 60000 });
