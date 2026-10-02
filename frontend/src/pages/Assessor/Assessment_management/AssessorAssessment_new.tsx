import { useState, useEffect } from 'react';
import {
  UserIcon,
  StarIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  ClockIcon
} from "@heroicons/react/24/outline";
import { useAuth } from "../../../context/AuthContext";
import {
  getAssessments,
  listUsers,
  getCompetencies,
  getProficiencyLevels,
  addAssessmentRating,
  updateAssessmentStatus,
  getMyAssignedEmployees,
  getEmployeeJobAssignments,
  getDepartments,
  getJobs,
  type Assessment,
  type AssessmentRating,
  type Competency,
  type ProficiencyLevel,
  type UserSummary
} from "../../../api/services";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Types
interface User extends UserSummary {
}

interface EmployeeAssessment {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  employee_full_name: string;
  department_id: string;
  department_name: string;
  job_role_id: string;
  job_role_name: string;
  start_date: string;
  last_updated: string;
  status: string;
  progress: number;
  competency_ratings: {
    id: string;
    competency_id: string;
    rating: number;
    comments: string;
    assessor_comments?: string;
    assessor_rating?: number;
  }[];
  assessor_id?: string;
  assessor_name?: string;
  assessor_rating?: number;
  assessor_comments?: string;
  assessor_status?: string;
}

// Helper functions
const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  };
  return date.toLocaleDateString('en-US', options);
};

export default function AssessorAssessment() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<EmployeeAssessment[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [proficiencyLevels, setProficiencyLevels] = useState<ProficiencyLevel[]>([]);
  const [assignedEmployees, setAssignedEmployees] = useState<User[]>([]);
  const [jobAssignments, setJobAssignments] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssessment, setSelectedAssessment] = useState<EmployeeAssessment | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [formData, setFormData] = useState({
    assessor_comments: '',
    assessor_rating: 0,
    competency_ratings: [] as {
      id: string;
      competency_id: string;
      rating: number;
      comments: string;
      assessor_comments: string;
      assessor_rating: number;
    }[]
  });

  // Load assessments from backend services
  useEffect(() => {
    const loadAssessorData = async () => {
      if (!user) return;

      try {
        setLoading(true);
        setError(null);

        console.log('Loading assessor data...');

        // Fetch all necessary data in parallel with error handling for each
        let allAssessments, users, comps, assignments, jobAssigns, depts, jobsData, levels;
        
        try {
          [
            allAssessments, 
            users, 
            comps, 
            assignments, 
            jobAssigns, 
            depts, 
            jobsData,
            levels
          ] = await Promise.all([
            getAssessments().catch(e => { console.error('getAssessments failed:', e); return []; }),
            listUsers().catch(e => { console.error('listUsers failed:', e); return []; }),
            getCompetencies().catch(e => { console.error('getCompetencies failed:', e); return []; }),
            getMyAssignedEmployees().catch(e => { console.error('getMyAssignedEmployees failed:', e); return []; }),
            getEmployeeJobAssignments().catch(e => { console.error('getEmployeeJobAssignments failed:', e); return []; }),
            getDepartments().catch(e => { console.error('getDepartments failed:', e); return []; }),
            getJobs().catch(e => { console.error('getJobs failed:', e); return []; }),
            getProficiencyLevels().catch(e => { console.error('getProficiencyLevels failed:', e); return []; })
          ]);
          console.log('All data fetched successfully');
        } catch (err) {
          console.error('Error fetching data:', err);
          throw err;
        }

        // Set basic data
        setCompetencies(comps || []);
        setProficiencyLevels([...(levels || [])].sort((a, b) => a.levelNumber - b.levelNumber));
        setAssignedEmployees(assignments || []);
        setJobAssignments(jobAssigns || []);
        setDepartments(depts || []);
        setJobs(jobsData || []);

        console.log('Fetched data:', {
          assessments: allAssessments?.length || 0,
          users: users?.length || 0,
          competencies: comps?.length || 0,
          assignments: assignments?.length || 0,
          jobAssignments: jobAssigns?.length || 0
        });

        // Build lookup maps
        const userById: Record<string, User> = {};
        (users || []).forEach(u => {
          userById[u.id] = u;
        });

        const jobAssignmentByEmployee: Record<string, any> = {};
        (jobAssigns || []).forEach(ja => {
          jobAssignmentByEmployee[ja.employeeId] = ja;
        });

        const jobById: Record<string, any> = {};
        (jobsData || []).forEach(job => {
          jobById[job.id] = job;
        });

        const departmentById: Record<string, any> = {};
        (depts || []).forEach(dept => {
          departmentById[dept.id] = dept;
        });

        // Get self assessments for employees
        const selfAssessments = (allAssessments || []).filter(a => a.type === 'SELF');
        const selfByEmployee: Record<string, Assessment> = {};
        selfAssessments.forEach(a => {
          if (!selfByEmployee[a.employeeId]) {
            selfByEmployee[a.employeeId] = a;
          }
        });

        // Show all ASSESSOR assessments in the organization (not filtered by assessorId)
        const assessorAssessments = (allAssessments || []).filter(
          a => a.type === 'ASSESSOR'
        );

        // Process assessments into the format needed for UI
        const processedData: EmployeeAssessment[] = assessorAssessments.map(assessorAssessment => {
          const employee = userById[assessorAssessment.employeeId];
          const selfAssessment = selfByEmployee[assessorAssessment.employeeId];
          const jobAssignment = jobAssignmentByEmployee[assessorAssessment.employeeId];
          const job = jobAssignment ? jobById[jobAssignment.jobId] : null;
          const department = job ? departmentById[job.departmentId] : null;

          // Combine ratings from self and assessor assessments
          const selfRatings = selfAssessment?.ratings || [];
          const assessorRatings = assessorAssessment.ratings || [];

          const byComp: Record<string, any> = {};

          // Start with self-ratings
          selfRatings.forEach(r => {
            byComp[r.competencyId] = {
              id: r.id,
              competency_id: r.competencyId,
              rating: r.rating,
              comments: r.comment || '',
              assessor_comments: '',
              assessor_rating: 0,
            };
          });

          // Overlay with assessor ratings
          assessorRatings.forEach(r => {
            if (byComp[r.competencyId]) {
              byComp[r.competencyId].assessor_rating = r.rating;
              byComp[r.competencyId].assessor_comments = r.comment || '';
            } else {
              byComp[r.competencyId] = {
                id: r.id,
                competency_id: r.competencyId,
                rating: 0,
                comments: '',
                assessor_comments: r.comment || '',
                assessor_rating: r.rating,
              };
            }
          });

          const compRatings = Object.values(byComp);
          const ratedCompetencies = compRatings.filter(r => r.assessor_rating > 0);
          const overallRating = ratedCompetencies.length > 0
            ? ratedCompetencies.reduce((sum, r) => sum + r.assessor_rating, 0) / ratedCompetencies.length
            : 0;

          // Build employee full name with proper null handling
          const employeeFirstName = employee?.firstName || '';
          const employeeLastName = employee?.lastName || '';
          const employeeFullName = `${employeeFirstName} ${employeeLastName}`.trim();
          const displayName = employeeFullName || employee?.email || `Employee ${assessorAssessment.employeeId}`;

          return {
            id: assessorAssessment.id,
            employee_id: assessorAssessment.employeeId,
            employee_name: displayName,
            employee_email: employee?.email || '',
            employee_full_name: displayName,
            department_id: department?.id || '',
            department_name: department?.name || 'No Department',
            job_role_id: job?.id || '',
            job_role_name: job?.title || 'No Job Role',
            start_date: assessorAssessment.createdAt,
            last_updated: assessorAssessment.completedAt || assessorAssessment.startedAt || assessorAssessment.createdAt,
            status: assessorAssessment.status,
            progress: compRatings.length,
            competency_ratings: compRatings,
            assessor_id: assessorAssessment.assessorId,
            assessor_name: assessorAssessment.assessorId
              ? (userById[assessorAssessment.assessorId]?.firstName || userById[assessorAssessment.assessorId]?.lastName
                ? `${userById[assessorAssessment.assessorId]?.firstName || ''} ${userById[assessorAssessment.assessorId]?.lastName || ''}`.trim()
                : userById[assessorAssessment.assessorId]?.email || 'Unknown assessor')
              : 'Unassigned',
            assessor_rating: overallRating,
            assessor_comments: '',
            assessor_status: assessorAssessment.status === 'REVIEWED' ? 'reviewed' : 'pending',
          };
        });

        console.log('Processing', assessorAssessments.length, 'assessor assessments');

        setAssessments(processedData);

        console.log('Assessor data loaded successfully');

      } catch (err: any) {
        console.error('Error loading assessor data:', err);
        const errorMessage = err?.message || 'Failed to load assessment data. Please refresh the page or contact support.';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadAssessorData();
  }, [user]);

  // Function to export assessment to PDF
  const exportToPDF = (assessment: EmployeeAssessment) => {
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text('Employee Assessment Report', 14, 22);

    // Add employee info
    doc.setFontSize(12);
    doc.text(`Employee: ${assessment.employee_full_name || assessment.employee_name}`, 14, 35);
    doc.text(`Department: ${assessment.department_name || 'N/A'}`, 14, 42);
    doc.text(`Assessment Date: ${formatDate(assessment.last_updated)}`, 14, 49);
    doc.text(`Status: ${assessment.status}`, 14, 56);

    // Add assessor info if available
    if (assessment.assessor_name) {
      doc.text(`Assessor: ${assessment.assessor_name}`, 14, 63);
      doc.text(`Assessor Rating: ${assessment.assessor_rating || 'Not rated'}`, 14, 70);
      doc.text(`Assessor Comments: ${assessment.assessor_comments || 'No comments'}`, 14, 77);
    }

    // Add competency ratings table
    const tableColumn = ["Competency", "Employee Rating", "Employee Comments", "Assessor Rating", "Assessor Comments"];
    const tableRows = assessment.competency_ratings?.map(rating => {
      const competencyName = competencies.find(c => c.id === rating.competency_id)?.name || `Competency ${rating.competency_id}`;

      return [
        competencyName,
        rating.rating.toString(),
        rating.comments || 'No comments',
        rating.assessor_rating?.toString() || 'Not rated',
        rating.assessor_comments || 'No comments'
      ];
    }) || [];

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 83,
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202] }
    });

    // Save the PDF
    const employeeName = assessment.employee_full_name || assessment.employee_name;
    doc.save(`${employeeName.replace(/\s+/g, '_')}_assessment.pdf`);
  };

  // Filter assessments by search term
  const filteredAssessments = assessments.filter(assessment =>
    (assessment.employee_full_name || assessment.employee_name).toLowerCase().includes(searchTerm.toLowerCase()) ||
    assessment.department_name?.toLowerCase().includes(searchTerm.toLowerCase() || '') ||
    assessment.job_role_name?.toLowerCase().includes(searchTerm.toLowerCase() || '')
  );

  // Handle rating an assessment
  const handleRateAssessment = (assessment: EmployeeAssessment) => {
    if (assessment.assessor_id !== user?.id || assessment.status === 'REVIEWED') return;
    setSelectedAssessment(assessment);

    // Initialize form data with existing ratings
    const mappedRatings = assessment.competency_ratings.map(rating => ({
      id: rating.id,
      competency_id: rating.competency_id,
      rating: rating.rating,
      comments: rating.comments || '',
      assessor_comments: rating.assessor_comments || '',
      assessor_rating: rating.assessor_rating || 0
    }));

    setFormData({
      assessor_comments: assessment.assessor_comments || '',
      assessor_rating: assessment.assessor_rating || 0,
      competency_ratings: mappedRatings
    });

    setShowRatingModal(true);
  };

  // Handle saving assessor ratings via backend services
  const handleSaveRatings = async () => {
    if (!selectedAssessment || !user) return;
    if (selectedAssessment.assessor_id !== user.id) {
      setError('You can view this assessment, but only its assigned assessor can submit ratings.');
      return;
    }
    if (formData.competency_ratings.length === 0 || formData.competency_ratings.some(rating => rating.assessor_rating <= 0)) {
      setError('Choose a proficiency level for every required competency before submitting your assessment.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Save each competency rating
      await Promise.all(formData.competency_ratings.map(rating =>
        addAssessmentRating(selectedAssessment.id, {
            competencyId: rating.competency_id,
            rating: rating.assessor_rating,
            comment: rating.assessor_comments || '',
          })
      ));

      // Update assessment status to REVIEWED
      await updateAssessmentStatus(selectedAssessment.id, 'REVIEWED');

      // Refresh data to get updated assessments
      const updatedAssessments = await getAssessments();
      const updatedAssessorAssessments = (updatedAssessments || []).filter(
        (a: Assessment) => a.type === 'ASSESSOR'
      );

      // Find the updated assessment
      const updatedAssessment = updatedAssessorAssessments.find(
        (a: Assessment) => a.id === selectedAssessment.id
      );

      if (updatedAssessment) {
        // Recalculate overall rating
        const ratedCompetencies = (updatedAssessment.ratings || []).filter(r => r.rating > 0);
        const overallRating = ratedCompetencies.length > 0
          ? ratedCompetencies.reduce((sum, r) => sum + r.rating, 0) / ratedCompetencies.length
          : 0;

        // Update local state
        const updatedEmployeeAssessment: EmployeeAssessment = {
          ...selectedAssessment,
          assessor_rating: overallRating,
          assessor_comments: formData.assessor_comments,
          assessor_status: 'reviewed',
          status: 'REVIEWED',
          last_updated: new Date().toISOString(),
        };

        setAssessments(prevAssessments =>
          prevAssessments.map(assessment =>
            assessment.id === selectedAssessment.id ? updatedEmployeeAssessment : assessment
          )
        );
      }

      setShowRatingModal(false);
      setSelectedAssessment(null);

    } catch (err) {
      console.error('Error saving ratings:', err);
      setError('Failed to save ratings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle rating change for a specific competency
  const handleRatingChange = (competencyId: string, field: string, value: any) => {
    setFormData({
      ...formData,
      competency_ratings: formData.competency_ratings.map(rating =>
        rating.competency_id === competencyId
          ? { ...rating, [field]: value }
          : rating
      )
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Employee Assessments</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Review and rate employee self-assessments
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by employee name, department, or job role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <UserIcon className="absolute left-3 top-1/2 h-5 w-5 text-gray-400 -translate-y-1/2" />
          </div>
        </div>

        {/* Employee Assessments Section */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Completed Assessments</h2>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredAssessments.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full">
                  <UserIcon className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">No Assessments Available</h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-lg">
                  {searchTerm ? 'No assessments match your search criteria.' : 'There are no completed assessments from your assigned employees yet.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {filteredAssessments.map(assessment => (
                <div
                  key={assessment.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700"
                >
                  <div className="p-6">
                    {/* Header with status badge */}
                    <div className="mb-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0 mr-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                            {assessment.employee_full_name || assessment.employee_name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">
                            {assessment.department_name || 'No Department'} {assessment.job_role_name ? `- ${assessment.job_role_name}` : ''}
                          </p>
                        </div>
                      </div>
                      {/* Status badge moved below name/department for better fit */}
                      <div className="flex items-center">
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full gap-1 ${
                          assessment.assessor_status === 'reviewed'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}>
                          {assessment.assessor_status === 'reviewed'
                            ? (
                              <>
                                <CheckCircleIcon className="h-3 w-3" />
                                <span>Reviewed</span>
                              </>
                            )
                            : (
                              <>
                                <ClockIcon className="h-3 w-3" />
                                <span>Pending</span>
                              </>
                            )
                          }
                        </span>
                      </div>
                    </div>

                    {/* Assessment Info Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">Completed On</h4>
                        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                          {formatDate(assessment.last_updated)}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">Competencies</h4>
                        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                          {assessment.competency_ratings?.length || 0} rated
                        </p>
                      </div>
                      {/* Email takes full width */}
                      <div className="col-span-2">
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">Email</h4>
                        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white break-words">
                          {assessment.employee_email || 'No email'}
                        </p>
                      </div>
                      {/* Your Rating takes one column */}
                      {assessment.assessor_rating ? (
                        <div className="col-span-2">
                          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">Your Rating</h4>
                          <div className="mt-1 flex items-center">
                            <span className="text-sm font-medium text-gray-900 dark:text-white mr-1">
                              {assessment.assessor_rating.toFixed(1)}
                            </span>
                            <StarIcon className="h-4 w-4 text-yellow-400" />
                          </div>
                        </div>
                      ) : (
                        <div className="col-span-2">
                          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">Your Rating</h4>
                          <p className="mt-1 text-sm font-medium text-gray-400 dark:text-gray-500 italic">
                            Not rated yet
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Status Message - Smaller and more compact */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mb-3">
                      <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center">
                        <svg className="h-3.5 w-3.5 text-blue-400 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        {assessment.assessor_status === 'reviewed'
                          ? "You have reviewed this assessment. You can edit your ratings or export to PDF."
                          : "This assessment needs your review. Rate the employee's competencies and provide feedback."}
                      </p>
                    </div>
                    <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                      Assigned assessor: {assessment.assessor_name || 'Unassigned'}{assessment.assessor_id === user?.id ? ' (you)' : ''}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRateAssessment(assessment)}
                        disabled={assessment.assessor_id !== user?.id || assessment.status === 'REVIEWED'}
                        title={assessment.assessor_id !== user?.id ? `Assigned to ${assessment.assessor_name || 'another assessor'}` : assessment.status === 'REVIEWED' ? 'This assessment is finalized' : undefined}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                      >
                        {assessment.assessor_id !== user?.id ? 'View Only' : assessment.status === 'REVIEWED' ? 'Reviewed' : assessment.assessor_rating ? 'Continue Rating' : 'Rate Assessment'}
                      </button>
                      <button
                        onClick={() => exportToPDF(assessment)}
                        className="rounded-lg bg-gray-200 p-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        title="Export to PDF"
                      >
                        <DocumentTextIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rating Modal */}
        {showRatingModal && selectedAssessment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-xl shadow-lg max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Rate Employee Assessment
                    </h2>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">
                      {selectedAssessment.employee_full_name || selectedAssessment.employee_name} - {selectedAssessment.department_name || 'No Department'}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowRatingModal(false)}
                    className="p-1 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Overall Assessment
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Your Overall Rating
                    </label>
                    <div className="flex items-center gap-2">
                      {proficiencyLevels.map((level) => (
                        <button
                          key={level.id}
                          type="button"
                          onClick={() => setFormData({...formData, assessor_rating: level.levelNumber})}
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            formData.assessor_rating >= level.levelNumber
                              ? 'bg-yellow-400 text-white'
                              : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {level.levelNumber}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Your Overall Comments
                    </label>
                    <textarea
                      value={formData.assessor_comments}
                      onChange={(e) => setFormData({...formData, assessor_comments: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                      rows={3}
                      placeholder="Enter your overall assessment comments..."
                    ></textarea>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Competency Ratings
                  </h3>
                  <div className="space-y-4">
                    {formData.competency_ratings.map((rating) => {
                      const competencyName = competencies.find(c => c.id === rating.competency_id)?.name || `Competency ${rating.competency_id}`;

                      return (
                        <div key={rating.competency_id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                            {competencyName}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                                Employee Rating: {rating.rating}/{proficiencyLevels[proficiencyLevels.length - 1]?.levelNumber || 0}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                {rating.comments || 'No comments provided'}
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Your Rating
                              </label>
                              <div className="flex items-center gap-2 mb-2">
                                {proficiencyLevels.map((level) => (
                                  <button
                                    key={level.id}
                                    type="button"
                                    title={level.label}
                                    onClick={() => handleRatingChange(rating.competency_id, 'assessor_rating', level.levelNumber)}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                      rating.assessor_rating >= level.levelNumber
                                        ? 'bg-yellow-400 text-white'
                                        : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                                    }`}
                                  >
                                    {level.levelNumber}
                                  </button>
                                ))}
                              </div>
                              <textarea
                                value={rating.assessor_comments}
                                onChange={(e) => handleRatingChange(rating.competency_id, 'assessor_comments', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                                rows={2}
                                placeholder="Enter your comments for this competency..."
                              ></textarea>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowRatingModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRatings}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Ratings'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
