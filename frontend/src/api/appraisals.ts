import { api } from './client';

// Types aligned with backend responses
export interface PerformanceAppraisalQuestion {
  id: string;
  organizationId: string;
  key: string;
  title: string;
  description?: string | null;
  howToMeasure?: string | null;
  goodIndicator?: string | null;
  redFlag?: string | null;
  ratingCriteria?: string | null;
  order: number;
}

export interface PerformanceAppraisal {
  id: string;
  organizationId: string;
  type: 'SELF' | 'ASSESSOR';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED';
  employeeId: string;
  assessorId?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  averageRating?: number | null;
  employee?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  assessor?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

export interface PerformanceAppraisalResponse {
  id: string;
  organizationId: string;
  appraisalId: string;
  questionId: string;
  employeeRating?: number | null;
  employeeComment?: string | null;
  assessorRating?: number | null;
  assessorComment?: string | null;
  question?: PerformanceAppraisalQuestion;
}

// API endpoints
export const listAppraisals = () => api.get<PerformanceAppraisal[]>('/appraisals');

export const getAppraisalQuestions = () => api.get<PerformanceAppraisalQuestion[]>('/appraisals/questions');

export const createSelfAppraisal = () => api.post<PerformanceAppraisal>('/appraisals/self');

export const createAssessorAppraisal = (employeeId: string) => 
  api.post<PerformanceAppraisal>('/appraisals/assessor', { employeeId });

export const updateAppraisalStatus = (id: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED') => 
  api.put<PerformanceAppraisal>(`/appraisals/${id}/status`, { status });

export const saveAppraisalResponse = (
  appraisalId: string, 
  questionId: string, 
  rating: number, 
  comment?: string
) => api.post<PerformanceAppraisalResponse>(
  `/appraisals/${appraisalId}/responses`, 
  { questionId, rating, comment }
);

export const getAppraisalResponses = (appraisalId: string) => 
  api.get<PerformanceAppraisalResponse[]>(`/appraisals/${appraisalId}/responses`);
