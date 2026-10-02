import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, type ReactNode } from "react";
import { useAuth } from "./context/AuthContext";
import AppLayout from "./layout/AppLayout";
import PublicLayout from "./layout/PublicLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import { RoleBasedRoute } from "./components/RoleBasedRoute";
import SetupOrganization from './pages/SetupOrganization';


// Lazy load components
const NotFound = lazy(() => import("./pages/OtherPage/NotFound"));
const Unauthorized = lazy(() => import("./pages/OtherPage/Unauthorized"));
const Login = lazy(() => import("./pages/auth/Login"));
const SignUp = lazy(() => import("./pages/auth/SignUp"));
const EmailConfirmation = lazy(() => import("./pages/auth/EmailConfirmation"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const OrgSignup = lazy(() => import("./pages/auth/OrgSignup"));
const AcceptInvite = lazy(() => import("./pages/auth/AcceptInvite"));
const OrganizationSettings = lazy(() => import("./pages/HR/OrganizationSettings"));
const HRRoleManagement = lazy(() => import("./pages/HR/Role_management/RoleManagement"));
const PageDescription = lazy(() => import("./pages/Employee/PageDescription/PageDescription"));
const Home = lazy(() => import("./pages/Dashboard/Home"));
const PublicHome = lazy(() => import("./pages/Dashboard/PublicHome"));
const AboutPage = lazy(() => import("./pages/NavPages/AboutPage"));
const Pricing = lazy(() => import("./pages/NavPages/Pricing"));
const Resources = lazy(() => import("./pages/NavPages/Resources"));
const BookDemoPage = lazy(() => import('./pages/NavPages/BookDemoPage'));
  const WelcomePage = lazy(() => import("./pages/auth/WelcomePage"));
  const BucketDiagnostic = lazy(() => import("./pages/BucketDiagnostic"));

// Performance Appraisal Components
const EmployeeAppraisal = lazy(() => import("./pages/Employee/Performance_appraisal/EmployeeAppraisal"));
const AssessorAppraisal = lazy(() => import("./pages/Assessor/Performance_appraisal/AssessorAppraisal"));
const HRAppraisal = lazy(() => import("./pages/HR/Performance_appraisal/HRAppraisal"));

// Employee Components
// const User = lazy(() => import("./pages/Employee/User_and_role_management/User"));
const EmployeeDetails = lazy(() => import("./pages/Employee/User_and_role_management/EmployeeDetails"));
const EmployeeJobAssignment = lazy(() => import("./pages/Employee/User_and_role_management/EmployeeJobAssignment"));
const EmployeeAssessorAssign = lazy(() => import("./pages/Employee/User_and_role_management/EmployeeAssessorAssign"));
const CompetencyDescription = lazy(() => import("./pages/Employee/Competency_framework/CompetencyDescription"));
const CompetencyCategory = lazy(() => import("./pages/Employee/Competency_framework/CompetencyCategory"));
const CompetencyProficiency = lazy(() => import("./pages/Employee/Competency_framework/CompetencyProficiency"));
const Competency = lazy(() => import("./pages/Employee/Competency_framework/Competency"));
const CompetencyDomain = lazy(() => import("./pages/Employee/Competency_framework/CompetencyDomain"));
const Job = lazy(() => import("./pages/Employee/Job_profiling/Job"));
const JobCompetencyProfile = lazy(() => import("./pages/Employee/Job_profiling/JobCompetencyProfile"));
const EmployeeAssessment = lazy(() => import("./pages/Employee/Assessment_management/EmployeeAssessment"));
const IndividualGap = lazy(() => import("./pages/Employee/Analytics/IndividualGap"));
const EmployeeConsensusAssessment = lazy(() => import("./pages/Employee/Assessment_management/ConsensusAssessment"));
const EmployeeAnalytics = lazy(() => import("./pages/Employee/Analytics/IndividualGap"));

// Assessor Components
const AssessorAnalytics = lazy(() => import("./pages/Assessor/Analytics/IndividualGap"));
const AssessorIndividualGap = lazy(() => import("./pages/Assessor/Analytics/IndividualGap"));
const AssessorEmployeeAssessment = lazy(() => import("./pages/Assessor/Assessment_management/EmployeeAssessment"));
// @ts-ignore - TypeScript can't find the module but it exists
const AssessorAssessment = lazy(() => import("./pages/Assessor/Assessment_management/AssessorAssessment"));
const AssessorConsensusAssessment = lazy(() => import("./pages/Assessor/Assessment_management/ConsensusAssessment"));
const AssessorCompetency = lazy(() => import("./pages/Assessor/Competency_framework/Competency"));
const AssessorCompetencyCategory = lazy(() => import("./pages/Assessor/Competency_framework/CompetencyCategory"));
const AssessorCompetencyDescription = lazy(() => import("./pages/Assessor/Competency_framework/CompetencyDescription"));
const AssessorCompetencyDomain = lazy(() => import("./pages/Assessor/Competency_framework/CompetencyDomain"));
const AssessorCompetencyProficiency = lazy(() => import("./pages/Assessor/Competency_framework/CompetencyProficiency"));
const AssessorJob = lazy(() => import("./pages/Assessor/Job_profiling/Job"));
const AssessorJobCompetencyProfile = lazy(() => import("./pages/Assessor/Job_profiling/JobCompetencyProfile"));
const AssessorPageDescription = lazy(() => import("./pages/Assessor/PageDescription/PageDescription"));
const AssessorEmployeeAssessorAssign = lazy(() => import("./pages/Assessor/User_and_role_management/EmployeeAssessorAssign"));
const AssessorEmployeeDetails = lazy(() => import("./pages/Assessor/User_and_role_management/EmployeeDetails"));
const AssessorEmployeeJobAssignment = lazy(() => import("./pages/Assessor/User_and_role_management/EmployeeJobAssignment"));
// const AssessorUser = lazy(() => import("./pages/Assessor/User_and_role_management/User"));

// HR Components
const HRPageDescription = lazy(() => import("./pages/HR/PageDescription/PageDescription"));
// const HRAnalytics = lazy(() => import("./pages/HR/Analytics/IndividualGap")); // Not used
// const HRIndividualGap = lazy(() => import("./pages/HR/Analytics/IndividualGap")); // Removed as HR doesn't need individual gap analysis
const HROrganizationGap = lazy(() => import("./pages/HR/Analytics/OrganizationGap"));
// Import HR AssessorAssessment component
const HRAssessorAssessment = lazy(() => import("./pages/HR/Assessment_management/AssessorAssessment"));
const HRConsensusAssessment = lazy(() => import("./pages/HR/Assessment_management/ConsensusAssessment"));
const HRCompetency = lazy(() => import("./pages/HR/Competency_framework/Competency"));
const HRCompetencyCategory = lazy(() => import("./pages/HR/Competency_framework/CompetencyCategory"));
const HRCompetencyDescription = lazy(() => import("./pages/HR/Competency_framework/CompetencyDescription"));
const HRCompetencyDomain = lazy(() => import("./pages/HR/Competency_framework/CompetencyDomain"));
const HRCompetencyProficiency = lazy(() => import("./pages/HR/Competency_framework/CompetencyProficiency"));
const HRJob = lazy(() => import("./pages/HR/Job_profiling/Job"));
const HRJobCompetencyProfile = lazy(() => import("./pages/HR/Job_profiling/JobCompetencyProfile"));
const HREmployeeAssessorAssign = lazy(() => import("./pages/HR/User_and_role_management/EmployeeAssessorAssign"));
const HREmployeeDetails = lazy(() => import("./pages/HR/User_and_role_management/EmployeeDetails"));
const HREmployeeJobAssignment = lazy(() => import("./pages/HR/User_and_role_management/EmployeeJobAssignment"));
// const HRUser = lazy(() => import("./pages/HR/User_and_role_management/User"));

// Loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
);

const EmployeeDetailsByRole = () => {
  const { user } = useAuth();
  if (user?.roles.includes('hr')) return <HREmployeeDetails />;
  if (user?.roles.includes('assessor')) return <AssessorEmployeeDetails />;
  return <EmployeeDetails />;
};

const RolePage = ({ employee, assessor, hr }: { employee: ReactNode; assessor?: ReactNode; hr?: ReactNode }) => {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  if (roles.includes('hr') && hr) return hr;
  if (roles.includes('assessor') && assessor) return assessor;
  return employee;
};

export default function App() {
  const { user, isInitializing } = useAuth();

  // Do not match a protected deep link against the public route table while
  // the saved session is still being restored.
  if (isInitializing) return <LoadingFallback />;

  return (
    <Router>
      <ScrollToTop />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Auth Routes */}
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<SignUp />} />
          <Route path="/auth/org-signup" element={<OrgSignup />} />
          <Route path="/auth/accept-invite" element={<AcceptInvite />} />
          <Route path="/auth/email-confirmation" element={<EmailConfirmation />} />
          <Route path="/auth/welcome-page" element={<WelcomePage />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />

          {/* Organization Setup Route - accessible after email confirmation */}
          <Route path="/setup-organization" element={<SetupOrganization />} />

          {/* Public pages - accessible to all users */}
          {!user ? (
            <Route element={<PublicLayout />}>
              <Route path="/" element={<PublicHome />} />
              <Route path="/home" element={<PublicHome />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/book-demo" element={<BookDemoPage />} />
            </Route>
          ) : (
            <Route element={<AppLayout />}>
              {/* Public pages within authenticated layout */}
              <Route path="/" element={<Home />} />
              <Route path="/home" element={<Home />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/book-demo" element={<BookDemoPage />} />

              {/* Diagnostic Routes - Available to all authenticated users */}
              <Route path="/bucket-diagnostic" element={<BucketDiagnostic />} />

              <Route element={<RoleBasedRoute allowedRoles={['employee', 'assessor', 'hr']} />}>
                <Route path="/dashboard" element={<Home />} />
                <Route path="/page-description" element={<RolePage employee={<PageDescription />} assessor={<AssessorPageDescription />} hr={<HRPageDescription />} />} />
                <Route path="/employee-details" element={<EmployeeDetailsByRole />} />
                <Route path="/employee-job-assignment" element={<RolePage employee={<EmployeeJobAssignment />} assessor={<AssessorEmployeeJobAssignment />} hr={<HREmployeeJobAssignment />} />} />
                <Route path="/employee-assessor-assign" element={<RolePage employee={<EmployeeAssessorAssign />} assessor={<AssessorEmployeeAssessorAssign />} hr={<HREmployeeAssessorAssign />} />} />
                <Route path="/competency-description" element={<RolePage employee={<CompetencyDescription />} assessor={<AssessorCompetencyDescription />} hr={<HRCompetencyDescription />} />} />
                <Route path="/competency-category" element={<RolePage employee={<CompetencyCategory />} assessor={<AssessorCompetencyCategory />} hr={<HRCompetencyCategory />} />} />
                <Route path="/proficiency-description" element={<RolePage employee={<CompetencyProficiency />} assessor={<AssessorCompetencyProficiency />} hr={<HRCompetencyProficiency />} />} />
                <Route path="/competency" element={<RolePage employee={<Competency />} assessor={<AssessorCompetency />} hr={<HRCompetency />} />} />
                <Route path="/competency-domain" element={<RolePage employee={<CompetencyDomain />} assessor={<AssessorCompetencyDomain />} hr={<HRCompetencyDomain />} />} />
                <Route path="/job" element={<RolePage employee={<Job />} assessor={<AssessorJob />} hr={<HRJob />} />} />
                <Route path="/job-competency-profile" element={<RolePage employee={<JobCompetencyProfile />} assessor={<AssessorJobCompetencyProfile />} hr={<HRJobCompetencyProfile />} />} />
                <Route path="/employee-assessment" element={<RolePage employee={<EmployeeAssessment />} assessor={<AssessorEmployeeAssessment />} hr={<HRAssessorAssessment />} />} />
                <Route path="/assessor-assessment" element={<RolePage employee={<EmployeeAssessment />} assessor={<AssessorAssessment />} hr={<HRAssessorAssessment />} />} />
                <Route path="/consensus-assessment" element={<RolePage employee={<EmployeeConsensusAssessment />} assessor={<AssessorConsensusAssessment />} hr={<HRConsensusAssessment />} />} />
                <Route path="/individual-gap" element={<RolePage employee={<IndividualGap />} assessor={<AssessorIndividualGap />} hr={<Navigate to="/organization-gap" replace />} />} />
                <Route path="/organization-gap" element={<RolePage employee={<Navigate to="/individual-gap" replace />} assessor={<Navigate to="/individual-gap" replace />} hr={<HROrganizationGap />} />} />
                <Route path="/analytics" element={<RolePage employee={<EmployeeAnalytics />} assessor={<AssessorAnalytics />} hr={<HROrganizationGap />} />} />
                <Route path="/performance-appraisal" element={<RolePage employee={<EmployeeAppraisal />} assessor={<AssessorAppraisal />} hr={<HRAppraisal />} />} />
              </Route>
              <Route element={<RoleBasedRoute allowedRoles={['hr']} />}>
                <Route path="/organization-settings" element={<OrganizationSettings />} />
                <Route path="/team-members" element={<HRRoleManagement />} />
                <Route path="/role-management" element={<Navigate to="/team-members" replace />} />
              </Route>
              {/* Redirect old role-prefixed paths to the shared URL. */}
              <Route path="/hr/organization-settings" element={<Navigate to="/organization-settings" replace />} />
              <Route path="/hr/role-management" element={<Navigate to="/team-members" replace />} />
              <Route path="/hr/dashboard" element={<Navigate to="/dashboard" replace />} />
              <Route path="/assessor/dashboard" element={<Navigate to="/dashboard" replace />} />
              <Route path="/employee/dashboard" element={<Navigate to="/dashboard" replace />} />
              <Route path="/hr/competency-proficiency" element={<Navigate to="/proficiency-description" replace />} />
              <Route path="/assessor/analytics" element={<Navigate to="/analytics" replace />} />
              <Route path="/hr/consensus-assessment" element={<Navigate to="/consensus-assessment" replace />} />
              <Route path="/hr/assessor-assessment" element={<Navigate to="/assessor-assessment" replace />} />
              <Route path="/assessor/assessment" element={<Navigate to="/assessor-assessment" replace />} />
              <Route path="/employee/consensus-assessment" element={<Navigate to="/consensus-assessment" replace />} />
              <Route path="/employee/analytics" element={<Navigate to="/analytics" replace />} />
              <Route path="/employee/performance-appraisal" element={<Navigate to="/performance-appraisal" replace />} />
              {['page-description','employee-details','employee-job-assignment','employee-assessor-assign','competency-description','competency-category','proficiency-description','competency','competency-domain','job','job-competency-profile','employee-assessment','individual-gap','organization-gap','performance-appraisal'].flatMap((path) => [
                <Route key={`hr-${path}`} path={`/hr/${path}`} element={<Navigate to={`/${path}`} replace />} />,
                <Route key={`assessor-${path}`} path={`/assessor/${path}`} element={<Navigate to={`/${path}`} replace />} />,
              ])}
            </Route>
          )}

          {/* Unauthorized Route */}
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* 404 Route */}
          <Route path="*" element={user ? <NotFound /> : <Navigate to="/auth/login" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
