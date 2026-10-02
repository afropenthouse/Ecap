import { useState, useEffect } from 'react';
import {
  UserIcon,
  FileIcon,
  ChatIcon
} from "../../../icons";
import { useAuth } from "../../../context/AuthContext";
import {
  getAssessments,
  getDepartments,
  getCompetencies,
  getProficiencyLevels,
  listUsers,
  createAssessorAssessment,
  updateAssessmentStatus,
  getEmployeeJobAssignments,
  getJobs
} from "../../../api/services";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Types from backend
interface Assessment {
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

interface AssessmentRating {
  id: string;
  competencyId: string;
  rating: number;
  comment: string | null;
  assessmentId: string;
}

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

interface Competency {
  id: string;
  name: string;
  description?: string | null;
  category?: { id: string; name: string; domain?: { id: string; domainName: string } };
}

interface ProficiencyLevel { id: string; levelNumber: number; label: string; description?: string | null }

interface Department {
  id: string;
  name: string;
}

interface Job {
  id: string;
  title: string;
  description?: string;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
}

interface EmployeeJobAssignment {
  id: string;
  employeeId: string;
  jobId: string;
  startDate?: string;
  job?: Job;
}

// Frontend assessment interface
interface UIAssessment {
  id: string;
  employee: {
    name: string;
    department: {
      id: string;
      name: string;
    }[];
  };
  assessor_name: string;
  assessment_date: string;
  status: 'In Progress' | 'Approved' | 'Completed';
  overall_rating: number;
  isEdited: boolean;
  competencies: {
    id: string;
    rating: number;
    comments: string;
    competency: {
      id: string;
      name: string;
    };
  }[];
  type: 'SELF' | 'ASSESSOR' | 'CONSENSUS';
  employeeId: string;
  assessorId?: string | null;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  };
  return date.toLocaleDateString('en-US', options);
};

// Map backend status to UI status
const mapBackendStatusToUI = (status: Assessment["status"]): UIAssessment["status"] => {
  switch (status) {
    case "COMPLETED":
      return "Completed";
    case "REVIEWED":
      return "Approved";
    case "PENDING":
    case "IN_PROGRESS":
    default:
      return "In Progress";
  }
};

export default function EmployeeAssessment() {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<UIAssessment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssessment, setSelectedAssessment] = useState<UIAssessment | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showNewAssessmentModal, setShowNewAssessmentModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [proficiencyLevels, setProficiencyLevels] = useState<ProficiencyLevel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobAssignments, setJobAssignments] = useState<EmployeeJobAssignment[]>([]);
  const [formData, setFormData] = useState<{
    employee_id: string;
    assessor_id: string;
    assessment_date: string;
    status: 'In Progress' | 'Approved' | 'Completed';
    overall_rating: number;
    department_id: string;
    competencies: {
      id: string;
      rating: number;
      comments: string;
      competency: Competency;
    }[];
  }>({
    employee_id: '',
    assessor_id: '',
    assessment_date: new Date().toISOString().split('T')[0],
    status: 'In Progress',
    overall_rating: 0,
    department_id: '',
    competencies: []
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        setLoading(true);
        setError(null);
        
        // Fetch all necessary data in parallel
        const [assessmentsData, deptRes, compRes, usersRes, jobsData, assignmentsData, levelsData] = await Promise.all([
          getAssessments(),
          getDepartments(),
          getCompetencies(),
          listUsers(),
          getJobs(),
          getEmployeeJobAssignments(),
          getProficiencyLevels()
        ]);
        
        // Set state with fetched data
        setDepartments(deptRes || []);
        setCompetencies(compRes || []);
        setProficiencyLevels([...(levelsData || [])].sort((a, b) => a.levelNumber - b.levelNumber));
        setUsers(usersRes || []);
        setJobs(jobsData || []);
        setJobAssignments(assignmentsData || []);
        
        // Process assessments
        const backendAssessments = (assessmentsData || []).filter(assessment => assessment.type === 'ASSESSOR');
        const mappedAssessments: UIAssessment[] = backendAssessments.map(assessment => {
          const employee = users.find(u => u.id === assessment.employeeId);
          const assessor = assessment.assessorId ? users.find(u => u.id === assessment.assessorId) : null;
          
          // Find employee's job assignment and department
          const jobAssignment = assignmentsData?.find(ja => ja.employeeId === assessment.employeeId);
          const job = jobAssignment ? jobsData?.find(j => j.id === jobAssignment.jobId) : null;
          const department = job ? deptRes?.find(d => d.id === job.departmentId) : null;

          // Calculate overall rating
          const ratings = assessment.ratings || [];
          const overall = ratings.length > 0 
            ? Number((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)) 
            : 0;
          
          // Map competencies for UI
          const mappedCompetencies = ratings.map(rating => {
            const comp = compRes?.find(c => c.id === rating.competencyId);
            return {
              id: rating.id,
              rating: rating.rating,
              comments: rating.comment || "",
              competency: { 
                id: rating.competencyId, 
                name: comp?.name || `Competency ${rating.competencyId}` 
              }
            };
          });

          return {
            id: assessment.id,
            employee: {
              name: employee ? `${employee.firstName} ${employee.lastName}` : `Employee ${assessment.employeeId}`,
              department: department ? [{ id: department.id, name: department.name }] : []
            },
            assessor_name: assessor ? `${assessor.firstName} ${assessor.lastName}` : "Unassigned",
            assessment_date: assessment.createdAt,
            status: mapBackendStatusToUI(assessment.status),
            overall_rating: overall,
            isEdited: false,
            competencies: mappedCompetencies,
            type: assessment.type,
            employeeId: assessment.employeeId,
            assessorId: assessment.assessorId
          };
        });
        
        setAssessments(mappedAssessments);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load assessment data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user]);
  
  useEffect(() => {
    // Initialize competencies in form data when competencies are loaded
    if (competencies.length > 0) {
      const initialCompetencies = competencies.map(competency => ({
        id: competency.id,
        rating: 0,
        comments: '',
        competency
      }));
      
      setFormData(prev => ({
        ...prev,
        competencies: initialCompetencies
      }));
    }
  }, [competencies]);

  const calculateOverallRating = (competencies: { rating: number }[]) => {
    if (competencies.length === 0) return 0;
    const ratedCompetencies = competencies.filter(comp => comp.rating > 0);
    if (ratedCompetencies.length === 0) return 0;
    const sum = ratedCompetencies.reduce((total, comp) => total + (comp.rating || 0), 0);
    return Number((sum / ratedCompetencies.length).toFixed(1));
  };

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      if (!formData.employee_id || !formData.assessor_id) {
        setError('Please select both employee and assessor');
        return;
      }

      // Create assessor assessment via backend
      const newAssessment = await createAssessorAssessment(formData.employee_id);

      // Add ratings if any were provided
      if (formData.competencies.some(comp => comp.rating > 0)) {
        // Note: You might need to add ratings in a separate step
        // This would require additional backend functions
        console.log('Ratings to be added:', formData.competencies.filter(comp => comp.rating > 0));
      }

      // Refresh assessments list
      const updatedAssessments = await getAssessments();
      if (updatedAssessments) {
        // Re-process assessments to update UI
        const employee = users.find(u => u.id === formData.employee_id);
        const assessor = users.find(u => u.id === formData.assessor_id);
        const jobAssignment = jobAssignments.find(ja => ja.employeeId === formData.employee_id);
        const job = jobAssignment ? jobs.find(j => j.id === jobAssignment.jobId) : null;
        const department = job ? departments.find(d => d.id === job.departmentId) : null;

        const newUIAssessment: UIAssessment = {
          id: newAssessment.id,
          employee: {
            name: employee ? `${employee.firstName} ${employee.lastName}` : `Employee ${formData.employee_id}`,
            department: department ? [{ id: department.id, name: department.name }] : []
          },
          assessor_name: assessor ? `${assessor.firstName} ${assessor.lastName}` : "Unassigned",
          assessment_date: newAssessment.createdAt,
          status: 'In Progress',
          overall_rating: calculateOverallRating(formData.competencies),
          isEdited: false,
          competencies: formData.competencies
            .filter(comp => comp.rating > 0)
            .map(comp => ({
              id: comp.id,
              rating: comp.rating,
              comments: comp.comments,
              competency: comp.competency
            })),
          type: 'ASSESSOR',
          employeeId: formData.employee_id,
          assessorId: formData.assessor_id
        };

        setAssessments(prev => [newUIAssessment, ...prev]);
      }

      setShowNewAssessmentModal(false);

      // Reset the form
      setFormData({
        employee_id: '',
        assessor_id: '',
        assessment_date: new Date().toISOString().split('T')[0],
        status: 'In Progress',
        overall_rating: 0,
        department_id: '',
        competencies: competencies.map(competency => ({
          id: competency.id,
          rating: 0,
          comments: '',
          competency
        }))
      });

    } catch (err) {
      console.error('Error creating assessment:', err);
      setError('Failed to create assessment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = (assessment: UIAssessment) => {
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.setTextColor(41, 128, 185);
    doc.text('Employee Competency Assessment', 14, 15);

    // Add subtitle
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Assessment Report', 14, 25);

    // Add assessment details
    doc.setFontSize(12);
    doc.text(`Employee: ${assessment.employee.name}`, 14, 40);
    doc.text(`Department: ${assessment.employee.department[0]?.name || 'N/A'}`, 14, 50);
    doc.text(`Assessment Date: ${formatDate(assessment.assessment_date)}`, 14, 60);
    doc.text(`Status: ${assessment.status}`, 14, 70);
    doc.text(`Overall Rating: ${assessment.overall_rating.toFixed(1)} / 5.0`, 14, 80);
    doc.text(`Assessment Type: ${assessment.type}`, 14, 90);

    // Add competencies table
    const tableData = assessment.competencies.map(comp => [
      comp.competency.name,
      comp.rating.toString(),
      comp.comments || 'N/A'
    ]);

    autoTable(doc, {
      startY: 100,
      head: [['Competency', 'Rating', 'Comments']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 10 }
    });

    // Add footer
    const pageCount = (doc as any).internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(
        `Generated on ${new Date().toLocaleDateString()}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Save the PDF
    doc.save(`Competency_Assessment_${assessment.employee.name}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const filteredAssessments = assessments.filter(assessment =>
    assessment.employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assessment.employee.department.some(dept => dept.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCompetencyRatingChange = (id: string, rating: number) => {
    const updatedCompetencies = formData.competencies.map(comp =>
      comp.id === id ? { ...comp, rating } : comp
    );
    setFormData({
      ...formData,
      competencies: updatedCompetencies,
      overall_rating: calculateOverallRating(updatedCompetencies)
    });
  };

  const handleNewAssessmentClick = () => {
    setFormData({
      employee_id: '',
      assessor_id: '',
      assessment_date: new Date().toISOString().split('T')[0],
      status: 'In Progress',
      overall_rating: 0,
      department_id: '',
      competencies: competencies.map(competency => ({
        id: competency.id,
        rating: 0,
        comments: '',
        competency
      }))
    });
    setSelectedAssessment(null);
    setShowNewAssessmentModal(true);
  };

  // Get assessors (users with ASSESSOR or HR role)
  const assessors = users.filter(u => u.role === 'ASSESSOR' || u.role === 'HR');
  
  // Get employees for dropdown
  const employees = users.filter(u => u.role === 'EMPLOYEE');

  return (
    <div className="container mx-auto px-4 py-8">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex flex-col justify-center items-center h-64 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading assessment data...</p>
        </div>
      ) : (
        <>
          {/* Header Section */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">Employee Competency Assessment</h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">View employee competency assessments</p>
            </div>
          </div>

          {/* Search and Filter Section */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="block w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white dark:placeholder-gray-400"
                placeholder="Search by employee name or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleNewAssessmentClick}
                className="flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                + Create Assessor Assessment
              </button>
              <button className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]">
                <FileIcon className="h-4 w-4" />
              </button>
              <button className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]">
                <ChatIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Assessment Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAssessments.map((assessment) => (
              <div
                key={assessment.id}
                className="group relative rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-blue-200 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-800/50"
              >
                <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gradient-to-r from-blue-600 to-purple-600" />

                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 mr-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white break-words">
                      {assessment.employee.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 break-words">
                      {assessment.employee.department.map(dept => dept.name).join(', ')}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Type: {assessment.type}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${
                    assessment.status === 'Approved'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : assessment.status === 'Completed'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    <span>
                      {assessment.status === 'Approved' ? (
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      ) : (
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                      )}
                    </span>
                    {assessment.status}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall Rating</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        {assessment.overall_rating || 0}
                      </span>
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <ChatIcon
                            key={i}
                            className={`h-5 w-5 ${
                              i < Math.floor(assessment.overall_rating || 0)
                                ? 'text-yellow-400'
                                : i < (assessment.overall_rating || 0)
                                ? 'text-yellow-400'
                                : 'text-gray-300 dark:text-gray-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-blue-600 to-purple-600"
                      style={{ width: `${((assessment.overall_rating || 0) / 5) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  <p>Assessment Date: {formatDate(assessment.assessment_date)}</p>
                  <p>Assessor: {assessment.assessor_name}</p>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setSelectedAssessment(assessment);
                      setShowDetailsModal(true);
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Assessment Details Modal */}
          {showDetailsModal && selectedAssessment && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm pt-24 pb-8">
              <div className="w-full max-w-2xl rounded-xl bg-white p-6 dark:bg-gray-900">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Assessment Details
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {selectedAssessment.employee.name} - {formatDate(selectedAssessment.assessment_date)}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                <div className="mt-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Employee</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedAssessment.employee.name}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Department</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedAssessment.employee.department.map(dept => dept.name).join(', ')}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Assessment Date</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedAssessment.assessment_date)}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Assessment Type</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedAssessment.type}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Assessor</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedAssessment.assessor_name}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Overall Rating</h3>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <ChatIcon
                              key={i}
                              className={`h-5 w-5 ${
                                i < Math.floor(selectedAssessment.overall_rating)
                                  ? 'text-yellow-400'
                                  : i < selectedAssessment.overall_rating
                                  ? 'text-yellow-400'
                                  : 'text-gray-300 dark:text-gray-600'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {selectedAssessment.overall_rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Competency Ratings</h3>
                    <div className="mt-4 space-y-4">
                      {selectedAssessment.competencies.map((competency, index) => (
                        <div key={index} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                              {competency.competency.name}
                            </h4>
                            <div className="flex items-center gap-1">
                              <ChatIcon className="h-4 w-4 text-yellow-400" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {competency.rating}
                              </span>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {competency.comments}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleExportPDF(selectedAssessment!)}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                  >
                    Export PDF
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* New Assessment Modal */}
          {showNewAssessmentModal && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm pt-24 pb-8">
              <div className="w-full max-w-2xl rounded-xl bg-white p-6 dark:bg-gray-900">
                <div className="flex items-start justify-between">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Create Assessor Assessment
                  </h2>
                  <button
                    onClick={() => setShowNewAssessmentModal(false)}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                <form
                  onSubmit={handleCreateAssessment}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Employee *
                      </label>
                      <select
                        value={formData.employee_id}
                        onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        required
                      >
                        <option value="">Select an employee</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.firstName} {employee.lastName} ({employee.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Assessor *
                      </label>
                      <select
                        value={formData.assessor_id}
                        onChange={(e) => setFormData({ ...formData, assessor_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        required
                      >
                        <option value="">Select an assessor</option>
                        {assessors.map((assessor) => (
                          <option key={assessor.id} value={assessor.id}>
                            {assessor.firstName} {assessor.lastName} ({assessor.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Assessment Date
                    </label>
                    <input
                      type="date"
                      id="date"
                      value={formData.assessment_date}
                      onChange={(e) => setFormData({ ...formData, assessment_date: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Competencies (Optional)</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      Note: Competency ratings can be added by the assessor after creating the assessment
                    </p>
                    <div className="mt-4 space-y-4">
                      {formData.competencies.map((formCompetency) => (
                        <div key={formCompetency.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-900 dark:text-white">
                              {formCompetency.competency.name}
                            </label>
                            <select
                              value={formCompetency.rating}
                              onChange={(e) => handleCompetencyRatingChange(formCompetency.id, Number(e.target.value))}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                            >
                              <option value="0">Select rating</option>
                              {proficiencyLevels.map(level => <option key={level.id} value={level.levelNumber}>{level.levelNumber} - {level.label}</option>)}
                            </select>
                          </div>
                          <textarea
                            placeholder="Add comments..."
                            className="mt-2 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                            rows={2}
                            value={formCompetency.comments}
                            onChange={(e) => {
                              const updatedCompetencies = formData.competencies.map(comp =>
                                comp.id === formCompetency.id ? { ...comp, comments: e.target.value } : comp
                              );
                              setFormData({ ...formData, competencies: updatedCompetencies });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewAssessmentModal(false);
                        setSelectedAssessment(null);
                      }}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50"
                    >
                      {loading ? 'Creating...' : 'Create Assessment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
