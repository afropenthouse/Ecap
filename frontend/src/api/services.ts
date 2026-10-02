import { api } from './client';
import { apiUploadForm } from './client';
import { apiFetch } from './client';

// Types aligned with backend responses
export interface Department {
  id: string;
  name: string;
}

export interface Job {
  id: string;
  title: string;
  description?: string;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
  requirements?: JobRequirement[];
}

export interface ProficiencyLevel {
  id: string;
  levelNumber: number;
  label: string;
  description?: string | null;
}

export interface Competency {
  id: string;
  name: string;
  description?: string | null;
  category?: { id: string; name: string; domain?: { id: string; domainName: string } };
}

export interface AssessmentRating {
  id: string;
  assessmentId: string;
  competencyId: string;
  rating: number;
  comment?: string | null;
}

export interface Assessment {
  id: string;
  type: 'SELF' | 'ASSESSOR' | 'CONSENSUS';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED';
  employeeId: string;
  assessorId?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  ratings?: AssessmentRating[];
}

export interface UserSummary {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'HR' | 'ASSESSOR' | 'EMPLOYEE';
  accountStatus?: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'DEACTIVATED';
  isActive?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  email?: string;
  logoUrl?: string;
  address?: string;
}

export interface UploadResult {
  url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  folder: string;
}

export const uploadImage = (file: File, folder?: string) => {
  const form = new FormData();
  form.append('file', file);
  if (folder) form.append('folder', folder);
  return apiUploadForm<UploadResult>('/uploads/image', form);
};

// Employees APIs
export interface EmployeeDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  profilePictureUrl?: string | null;
  isLockedUntil?: string | null;
  role?: 'EMPLOYEE' | 'ASSESSOR';
  isActive?: boolean;
  onboardingCompleted?: boolean;
  departmentIds: string[];
  departments: Array<{ id: string; name: string }>;
}

// Update the employees APIs to include the correct return type
export const listEmployees = () => api.get<EmployeeDetail[]>('/employees');
export const createEmployee = (payload: { email: string; firstName: string; lastName: string; phone?: string; profilePictureUrl?: string }) =>
  api.post<EmployeeDetail>('/employees', payload);
export const updateEmployeeDepartments = (id: string, payload: { departmentIds: string[] }) =>
  api.put<EmployeeDetail>(`/employees/${id}/departments`, payload);

// Add this new API for getting user details
export const getUserProfile = (id: string) => api.get<{
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profilePictureUrl?: string;
  role: string;
  isLockedUntil?: string | null;
  onboardingCompleted?: boolean;
  departments?: Array<{ id: string; name: string }>;
}>('/users/' + id);

// Competencies APIs
export const getDomains = () => api.get('/competencies/domains');
export const getCategories = () => api.get('/competencies/categories');
export const getCompetencies = () => api.get<Competency[]>('/competencies');
export const getProficiencyLevels = () => api.get<ProficiencyLevel[]>('/competencies/levels');
export const createProficiencyLevel = (payload: { levelNumber: number; label: string; description?: string }) =>
  api.post<ProficiencyLevel>('/competencies/levels', payload);
export const updateProficiencyLevel = (id: string, payload: { levelNumber?: number; label?: string; description?: string }) =>
  api.put<ProficiencyLevel>(`/competencies/levels/${id}`, payload);
export const deleteProficiencyLevel = (id: string) => api.delete(`/competencies/levels/${id}`);

export const createCategory = (payload: { name: string; domainId?: string }) => api.post('/competencies/categories', payload);
export const updateCategory = (id: string, payload: { name?: string; domainId?: string }) => api.put(`/competencies/categories/${id}`, payload);
export const deleteCategory = (id: string) => api.delete(`/competencies/categories/${id}`);

export const createDomain = (payload: { domainName: string }) => api.post('/competencies/domains', payload);
export const updateDomain = (id: string, payload: { domainName?: string }) => api.put(`/competencies/domains/${id}`, payload);
export const deleteDomain = (id: string) => api.delete(`/competencies/domains/${id}`);

export const createCompetency = (payload: { name: string; description?: string; categoryId?: string }) => api.post('/competencies', payload);
export const updateCompetency = (id: string, payload: { name?: string; description?: string; categoryId?: string }) => api.put(`/competencies/${id}`, payload);
export const deleteCompetency = (id: string) => api.delete(`/competencies/${id}`);

// Departments APIs
export const getDepartments = () => api.get<Department[]>('/departments');
export const createDepartment = (payload: { name: string }) => api.post<Department>('/departments', payload);
export const updateDepartment = (id: string, payload: { name?: string }) => api.put<Department>(`/departments/${id}`, payload);
export const deleteDepartment = (id: string) => api.delete(`/departments/${id}`);

// Jobs APIs
export const getJobs = () => api.get<Job[]>('/jobs');
export const createJob = (payload: { title: string; description?: string; departmentId?: string | null }) =>
  api.post<Job>('/jobs', payload);
export const updateJob = (id: string, payload: { title?: string; description?: string; departmentId?: string | null }) =>
  api.put<Job>(`/jobs/${id}`, payload);
export const deleteJob = (id: string) => api.delete(`/jobs/${id}`);

// Job Requirements APIs
export interface JobRequirement {
  id: string;
  jobId: string;
  competencyId: string;
  requiredLevel: number;
}
export const addJobRequirement = (jobId: string, payload: { competencyId: string; requiredLevel: number }) =>
  api.post<JobRequirement>(`/jobs/${jobId}/requirements`, payload);
export const updateJobRequirement = (jobId: string, reqId: string, payload: { competencyId?: string; requiredLevel?: number }) =>
  api.put<JobRequirement>(`/jobs/${jobId}/requirements/${reqId}`, payload);
export const deleteJobRequirement = (jobId: string, reqId: string) =>
  api.delete(`/jobs/${jobId}/requirements/${reqId}`);

// Assessments APIs
export const getAssessments = () => api.get<Assessment[]>('/assessments');
export const createAssessment = (data: { 
  type: 'SELF' | 'ASSESSOR' | 'CONSENSUS'; 
  employeeId?: string; 
  assessorId?: string; 
}) => api.post<Assessment>('/assessments/self', data);
export const createAssessorAssessment = (employeeId: string) => api.post<Assessment>('/assessments/assessor', { employeeId });
export const updateAssessmentStatus = (id: string, status: Assessment['status']) => api.put<Assessment>(`/assessments/${id}/status`, { status });
export const addAssessmentRating = (id: string, payload: { competencyId: string; rating: number; comment?: string }) =>
  api.post<AssessmentRating>(`/assessments/${id}/ratings`, payload);
export const finalizeConsensusAssessment = (employeeId: string) =>
  api.post<Assessment>(`/assessments/consensus/${employeeId}`);
export const getAssessmentRatings = (assessmentId: string) =>
  api.get<AssessmentRating[]>(`/assessments/${assessmentId}/ratings`);

// Users APIs (HR & Assessor)
export const listUsers = () => api.get<UserSummary[]>('/users');
export const getUserById = (id: string) => api.get<UserSummary>(`/users/${id}`);
export const updateUserRole = (id: string, role: 'EMPLOYEE' | 'ASSESSOR' | 'HR') => api.put(`/roles/${id}`, { role });
export const setOrganizationUserActive = (id: string, isActive: boolean) => api.patch<{ id: string; isActive: boolean }>(`/users/${id}/activation`, { isActive });
export const deleteOrganizationUser = (id: string) => api.delete(`/users/${id}`);
// Update user profile (HR can update any user; Employee can update own with 12h lock)
export const updateUser = (id: string, payload: { firstName?: string; lastName?: string; phone?: string; profilePictureUrl?: string; departmentIds?: string[] }) =>
  api.put<{ id: string }>(`/users/${id}`, payload);

// Assessor Assignments APIs
export interface AssessorAssignment {
  id: string;
  assessorId: string;
  employeeId: string;
  assessor?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  employee?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}
export const listAssessorAssignments = (params?: { employeeId?: string; assessorId?: string }) => {
  const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
  return api.get<AssessorAssignment[]>(`/assignments${query}`);
};
export const createAssessorAssignment = (payload: { assessorId: string; employeeId: string }) =>
  api.post<AssessorAssignment>('/assignments', payload);
export const updateAssessorAssignment = (id: string, payload: { assessorId?: string; employeeId?: string }) =>
  api.put<AssessorAssignment>(`/assignments/${id}`, payload);
export const deleteAssessorAssignment = (id: string) => api.delete(`/assignments/${id}`);
// Get assignments for current assessor (filters by current user)
export const getAssessorAssignments = () => api.get<AssessorAssignment[]>('/assignments');
// Get list of employees assigned to current assessor
export const getMyAssignedEmployees = async (): Promise<UserSummary[]> => {
  try {
    // Get assignments for current assessor
    const assignments = await api.get<AssessorAssignment[]>('/assignments');
    if (!assignments || assignments.length === 0) return [];
    
    // Get all users
    const users = await api.get<UserSummary[]>('/users');
    
    // Filter to get only the assigned employees
    const employeeIds = assignments.map(a => a.employeeId);
    return users.filter(u => employeeIds.includes(u.id));
  } catch (error) {
    console.error('Error fetching assigned employees:', error);
    return [];
  }
};

// Employee Job Assignments APIs
export interface EmployeeJobAssignment {
  id: string;
  employeeId: string;
  jobId: string;
  startDate?: string;
  createdAt?: string;
  job?: Job;
  employee?: { id: string; firstName: string | null; lastName: string | null; email: string };
}
export const listEmployeeJobAssignments = (params?: { employeeId?: string; jobId?: string }) => {
  const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
  return api.get<EmployeeJobAssignment[]>(`/job-assignments${query}`);
};
export const createEmployeeJobAssignment = (payload: { employeeId: string; jobId: string; startDate?: string }) =>
  api.post<EmployeeJobAssignment>('/job-assignments', payload);
export const updateEmployeeJobAssignment = (id: string, payload: { employeeId?: string; jobId?: string; startDate?: string }) =>
  api.put<EmployeeJobAssignment>(`/job-assignments/${id}`, payload);
export const deleteEmployeeJobAssignment = (id: string) => api.delete(`/job-assignments/${id}`);
export const getEmployeeJobAssignments = (employeeId?: string) => {
  const url = employeeId ? `/job-assignments?employeeId=${employeeId}` : '/job-assignments';
  return api.get<EmployeeJobAssignment[]>(url);
};
export const getMyJobAssignment = () => api.get<EmployeeJobAssignment | null>('/job-assignments/current');

// Organization APIs
export const getMyOrganization = () => api.get<Organization>('/organizations/me');
export const listOrganizationsPublic = () => api.get<Pick<Organization, 'id' | 'name' | 'logoUrl'>[]>('/organizations/public');
export const updateMyOrganization = (payload: { name?: string; email?: string; logoUrl?: string; address?: string }) => api.put<Organization>('/organizations/me', payload);
export const inviteOrganizationMember = (payload: { firstName: string; lastName: string; email: string; role: 'EMPLOYEE' | 'ASSESSOR' | 'HR' }) => api.post('/organizations/me/invitations', payload);
export async function signupOrganizationAdmin(payload: {
  organizationName: string;
  organizationEmail: string;
  adminEmail: string;
  adminPassword: string;
  firstName?: string;
  lastName?: string;
}) {
  return apiFetch('/auth/org/signup', {
    method: 'POST',
    body: payload,
  });
}

export async function verifyEmail(token: string) {
  return apiFetch('/auth/verify-email', {
    method: 'POST',
    body: { token },
  });
}

export async function verifyEmailCode(email: string, code: string) {
  return apiFetch('/auth/verify-email-code', { method: 'POST', body: { email, code } });
}

export async function resendEmailVerification(email: string) {
  return apiFetch('/auth/verify-email/resend', {
    method: 'POST',
    body: { email },
  });
}

// Re-export API client for convenience in pages
export { api };
