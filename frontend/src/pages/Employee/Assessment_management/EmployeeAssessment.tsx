import { useState, useEffect } from 'react';
import { UserIcon } from "../../../icons";
import { useAuth } from "../../../context/AuthContext";
import {
  getAssessments,
  createAssessment,
  updateAssessmentStatus,
  addAssessmentRating,
  getCompetencies,
  getMyJobAssignment,
  getDepartments,
  getJobs,
  getProficiencyLevels,
  type Assessment,
  type Competency,
  type AssessmentRating,
  type ProficiencyLevel
} from "../../../api/services";

// Types
interface CompetencyRating extends AssessmentRating {
  comment: string;
}

// Helper functions
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  };
  return date.toLocaleDateString('en-US', options);
};

const calculateProgress = (ratings: AssessmentRating[], totalCompetencies: number): number => {
  if (!ratings || totalCompetencies === 0) return 0;
  const ratedCompetencies = ratings.filter(r => r.rating > 0).length;
  return Math.round((ratedCompetencies / totalCompetencies) * 100);
};

const defaultProficiencyLevels: ProficiencyLevel[] = [
  { id: 'default-1', levelNumber: 1, label: 'Beginner' },
  { id: 'default-2', levelNumber: 2, label: 'Developing' },
  { id: 'default-3', levelNumber: 3, label: 'Proficient' },
  { id: 'default-4', levelNumber: 4, label: 'Advanced' },
  { id: 'default-5', levelNumber: 5, label: 'Expert' },
];

export default function EmployeeAssessment() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [currentAssessment, setCurrentAssessment] = useState<Assessment | null>(null);
  const [assessorAssessment, setAssessorAssessment] = useState<Assessment | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [proficiencyLevels, setProficiencyLevels] = useState<ProficiencyLevel[]>([]);
  const [jobAssignment, setJobAssignment] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  // UI state
  const [activeCompetencyIndex, setActiveCompetencyIndex] = useState<number>(0);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [currentRating, setCurrentRating] = useState<number>(0);
  const [currentComments, setCurrentComments] = useState<string>('');

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        setLoading(true);
        
        // Load all necessary data in parallel
        const [assessmentsData, competenciesData, jobAssignmentData, departmentsData, jobsData, levelsData] = await Promise.all([
          getAssessments(),
          getCompetencies(),
          getMyJobAssignment(),
          getDepartments(),
          getJobs(),
          getProficiencyLevels()
        ]);

        setAssessments(assessmentsData || []);
        const requiredIds = new Set<string>((jobAssignmentData?.job?.requirements || []).map((requirement: { competencyId: string }) => requirement.competencyId));
        const availableCompetencies = competenciesData || [];
        setCompetencies(requiredIds.size > 0
          ? availableCompetencies.filter(competency => requiredIds.has(competency.id))
          : availableCompetencies);
        const configuredLevels = [...(levelsData || [])].sort((a, b) => a.levelNumber - b.levelNumber);
        setProficiencyLevels(configuredLevels.length > 0 ? configuredLevels : defaultProficiencyLevels);
        setJobAssignment(jobAssignmentData);
        setDepartments(departmentsData || []);
        setJobs(jobsData || []);

        // Find current self-assessment
        const selfAssessment = assessmentsData?.find(
          (a: Assessment) => a.type === 'SELF' && a.employeeId === user.id
        );
        
        if (selfAssessment) {
          setCurrentAssessment(selfAssessment);
        }

        // Find if any assessor has reviewed this employee
        const reviewedAssessorAssessment = assessmentsData?.find(
          (a: Assessment) => a.type === 'ASSESSOR' && a.employeeId === user.id && a.status === 'REVIEWED'
        );
        
        if (reviewedAssessorAssessment) {
          setAssessorAssessment(reviewedAssessorAssessment);
        }

      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load assessment data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Function to start a new assessment
  const startNewAssessment = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Create new self-assessment via backend
      const newAssessment = await createAssessment({
        type: 'SELF'
      });

      // Update assessment status to IN_PROGRESS
      const updatedAssessment = await updateAssessmentStatus(newAssessment.id, 'IN_PROGRESS');
      
      setCurrentAssessment(updatedAssessment);
      setActiveCompetencyIndex(0);
      if (competencies.length > 0) setShowRatingModal(true);
      else setShowSummaryModal(true);

    } catch (err) {
      console.error('Error starting assessment:', err);
      setError('Failed to start assessment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Function to handle competency rating
  const handleCompetencyRating = async (rating: number, comment: string) => {
    if (!currentAssessment || !competencies[activeCompetencyIndex]) return;

    try {
      setLoading(true);

      const competency = competencies[activeCompetencyIndex];

      // Add rating via backend
      await addAssessmentRating(currentAssessment.id, {
        competencyId: competency.id,
        rating,
        comment
      });

      // Refresh assessments to get updated ratings
      const updatedAssessments = await getAssessments();
      setAssessments(updatedAssessments || []);

      const updatedSelfAssessment = updatedAssessments?.find(
        (a: Assessment) => a.id === currentAssessment.id
      );

      if (updatedSelfAssessment) {
        setCurrentAssessment(updatedSelfAssessment);
      }

      const ratedIds = new Set((updatedSelfAssessment?.ratings || []).map(existingRating => existingRating.competencyId));
      const nextIndex = competencies.findIndex(item => !ratedIds.has(item.id));
      if (nextIndex >= 0) {
        setActiveCompetencyIndex(nextIndex);
      } else {
        setShowRatingModal(false);
        setShowSummaryModal(true);
      }

    } catch (err) {
      console.error('Error saving rating:', err);
      setError('Failed to save rating. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Function to submit the assessment
  const submitAssessment = async () => {
    if (!currentAssessment) return;

    try {
      setLoading(true);

      // Update assessment status to COMPLETED
      const finalAssessment = await updateAssessmentStatus(currentAssessment.id, 'COMPLETED');
      
      setCurrentAssessment(finalAssessment);
      setShowSummaryModal(false);
      setShowSuccessModal(true);

    } catch (err) {
      console.error('Error submitting assessment:', err);
      setError('Failed to submit assessment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get current job and department info
  const currentJob = jobAssignment ? jobs.find(j => j.id === jobAssignment.jobId) : null;
  const currentDepartment = currentJob ? departments.find(d => d.id === currentJob.departmentId) : null;

  // Calculate progress
  const progress = currentAssessment ? calculateProgress(currentAssessment.ratings || [], competencies.length) : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="flex flex-col justify-center items-center h-64 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your assessment data...</p>
        </div>
      ) : (
        <>
          {/* Header Section */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">My Competency Assessment</h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                {currentAssessment
                  ? "View and manage your competency self-assessment"
                  : "Create your competency self-assessment"}
              </p>
            </div>
            
            {currentAssessment && (currentAssessment.status === 'COMPLETED' || currentAssessment.status === 'REVIEWED' || assessorAssessment?.status === 'REVIEWED') && (
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const updatedAssessments = await getAssessments();
                    setAssessments(updatedAssessments || []);
                    
                    const updatedSelfAssessment = updatedAssessments?.find(
                      (a: Assessment) => a.id === currentAssessment.id
                    );
                    if (updatedSelfAssessment) {
                      setCurrentAssessment(updatedSelfAssessment);
                    }

                    // Check for reviewed assessor assessment
                    const reviewedAssessorAssessment = updatedAssessments?.find(
                      (a: Assessment) => a.type === 'ASSESSOR' && a.employeeId === user?.id && a.status === 'REVIEWED'
                    );
                    if (reviewedAssessorAssessment) {
                      setAssessorAssessment(reviewedAssessorAssessment);
                    }
                  } catch (err) {
                    console.error('Error refreshing assessment:', err);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Check for Updates
              </button>
            )}
          </div>

          {/* Start Assessment Section */}
          {!currentAssessment && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
              <div className="flex flex-col items-center justify-center space-y-6 text-center">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full">
                  <UserIcon className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Start Your Competency Assessment</h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-lg">
                  This assessment will help you evaluate your skills and competencies across different areas.
                  Your responses will be used to create a personalized development plan.
                </p>

                {/* Current Job Information */}
                {jobAssignment && currentJob && currentDepartment && (
                  <div className="w-full max-w-md bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 text-left">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">Your Current Assignment</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Department:</span>
                        <p className="font-medium text-gray-900 dark:text-white">{currentDepartment.name}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Job Role:</span>
                        <p className="font-medium text-gray-900 dark:text-white">{currentJob.title}</p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={startNewAssessment}
                  disabled={loading}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Starting Assessment...' : 'Start Assessment'}
                </button>
              </div>
            </div>
          )}

          {/* Assessment in Progress */}
          {currentAssessment && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="p-6">
                {/* Assessment Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Self-Assessment
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Started on {formatDate(currentAssessment.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {currentAssessment.status === 'COMPLETED' && (
                      <button
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const updatedAssessments = await getAssessments();
                            const updatedSelfAssessment = updatedAssessments?.find(
                              (a: Assessment) => a.id === currentAssessment.id
                            );
                            if (updatedSelfAssessment) {
                              setCurrentAssessment(updatedSelfAssessment);
                            }

                            // Check for reviewed assessor assessment
                            const reviewedAssessorAssessment = updatedAssessments?.find(
                              (a: Assessment) => a.type === 'ASSESSOR' && a.employeeId === user?.id && a.status === 'REVIEWED'
                            );
                            if (reviewedAssessorAssessment) {
                              setAssessorAssessment(reviewedAssessorAssessment);
                            }
                          } catch (err) {
                            console.error('Error refreshing assessment:', err);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Check for updates"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                      </button>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div
                          className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {progress}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Assessment Info */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</h3>
                    <div className="mt-1 flex items-center">
                      {assessorAssessment?.status === 'REVIEWED' || currentAssessment.status === 'REVIEWED' ? (
                        <>
                          <svg className="h-4 w-4 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                          <span className="text-gray-900 dark:text-white">Reviewed</span>
                        </>
                      ) : currentAssessment.status === 'COMPLETED' ? (
                        <>
                          <svg className="h-4 w-4 mr-1 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <span className="text-gray-900 dark:text-white">Completed - Pending Review</span>
                        </>
                      ) : currentAssessment.status === 'IN_PROGRESS' ? (
                        <>
                          <svg className="h-4 w-4 mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <span className="text-gray-900 dark:text-white">In Progress</span>
                        </>
                      ) : (
                        <span className="text-gray-900 dark:text-white capitalize">{currentAssessment.status.toLowerCase()}</span>
                      )}
                    </div>
                  </div>
                  
                  {currentDepartment && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Department</h3>
                      <p className="mt-1 text-gray-900 dark:text-white">
                        {currentDepartment.name}
                      </p>
                    </div>
                  )}
                  
                  {currentJob && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Job Role</h3>
                      <p className="mt-1 text-gray-900 dark:text-white">
                        {currentJob.title}
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</h3>
                    <p className="mt-1 text-gray-900 dark:text-white">
                      {formatDate(currentAssessment.completedAt || currentAssessment.startedAt || currentAssessment.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Status Message */}
                <div className={`${
                  assessorAssessment?.status === 'REVIEWED' || currentAssessment.status === 'REVIEWED'
                    ? 'bg-green-50 dark:bg-green-900/20'
                    : currentAssessment.status === 'COMPLETED'
                      ? 'bg-yellow-50 dark:bg-yellow-900/20'
                      : 'bg-blue-50 dark:bg-blue-900/20'
                } rounded-lg p-4 mb-6`}>
                  <div className="flex">
                    <div className="flex-shrink-0">
                      {assessorAssessment?.status === 'REVIEWED' || currentAssessment.status === 'REVIEWED' ? (
                        <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      ) : currentAssessment.status === 'COMPLETED' ? (
                        <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="ml-3">
                      <p className={`text-sm ${
                        assessorAssessment?.status === 'REVIEWED' || currentAssessment.status === 'REVIEWED'
                          ? 'text-green-700 dark:text-green-300'
                          : currentAssessment.status === 'COMPLETED'
                            ? 'text-yellow-700 dark:text-yellow-300'
                            : 'text-blue-700 dark:text-blue-300'
                      }`}>
                        {assessorAssessment?.status === 'REVIEWED' || currentAssessment.status === 'REVIEWED'
                          ? "Your assessment has been reviewed by your assessor. Thank you for your participation."
                          : currentAssessment.status === 'COMPLETED'
                            ? "Your assessment is pending review by your assessor. You'll see updated status once it's reviewed."
                            : "Continue your assessment by rating your competencies. Your progress is automatically saved."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Competencies Section */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Competency Ratings</h3>
                    {(currentAssessment.status === 'IN_PROGRESS' || currentAssessment.status === 'PENDING') && (
                      <button
                        onClick={async () => {
                          if (currentAssessment.status === 'PENDING') {
                            const started = await updateAssessmentStatus(currentAssessment.id, 'IN_PROGRESS');
                            setCurrentAssessment(started);
                          }
                          if (competencies.length === 0) {
                            setShowSummaryModal(true);
                            return;
                          }
                          const ratedIds = new Set((currentAssessment.ratings || []).map(rating => rating.competencyId));
                          const nextIndex = competencies.findIndex(competency => !ratedIds.has(competency.id));
                          if (nextIndex < 0) setShowSummaryModal(true);
                          else {
                            setActiveCompetencyIndex(nextIndex);
                            setCurrentRating(0);
                            setCurrentComments('');
                            setShowRatingModal(true);
                          }
                        }}
                        disabled={loading}
                        className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                      >
                        Continue Assessment
                      </button>
                    )}
                    {(currentAssessment.status === 'COMPLETED' || currentAssessment.status === 'REVIEWED') && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                        Assessment is {currentAssessment.status.toLowerCase()} and cannot be modified
                      </div>
                    )}
                  </div>

                  {(!currentAssessment.ratings || currentAssessment.ratings.length === 0) ? (
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-6 text-center">
                      <p className="text-gray-500 dark:text-gray-400">
                        {competencies.length === 0
                          ? 'No competencies are configured for this organisation yet. You can still submit this assessment.'
                          : 'No competencies have been rated yet. Click "Continue Assessment" to start rating your competencies.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {currentAssessment.ratings.map((rating) => {
                        const competency = competencies.find(c => c.id === rating.competencyId);
                        return (
                          <div key={rating.competencyId} className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-medium text-gray-900 dark:text-white">{competency?.name || 'Unknown Competency'}</h4>
                              <div className="flex items-center">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">Rating:</span>
                                <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-1 rounded text-sm font-medium">
                                  {rating.rating}/{proficiencyLevels[proficiencyLevels.length - 1]?.levelNumber || '?'}
                                </span>
                              </div>
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">{rating.comment}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex justify-end gap-3">
                  {assessorAssessment?.status === 'REVIEWED' || currentAssessment.status === 'REVIEWED' ? (
                    <div className="flex items-center text-green-600 dark:text-green-400">
                      <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>Assessment reviewed on {formatDate((assessorAssessment || currentAssessment).completedAt || (assessorAssessment || currentAssessment).createdAt)}</span>
                    </div>
                  ) : currentAssessment.status === 'COMPLETED' ? (
                    <div className="flex items-center text-yellow-600 dark:text-yellow-400">
                      <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <span>Assessment completed on {formatDate(currentAssessment.completedAt || currentAssessment.createdAt)}</span>
                    </div>
                    ) : competencies.length > 0 && competencies.every(competency => currentAssessment.ratings?.some(rating => rating.competencyId === competency.id)) && (
                    <button
                      onClick={() => setShowSummaryModal(true)}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                    >
                      Complete Assessment
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Rating Modal */}
          {showRatingModal && currentAssessment && activeCompetencyIndex < competencies.length && (
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
              <div className="w-full max-w-xl rounded-xl bg-white dark:bg-gray-900 max-h-[90vh] flex flex-col">
                <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Rate Your Competency
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {activeCompetencyIndex + 1} of {competencies.length}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowRatingModal(false)}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {competencies[activeCompetencyIndex] && (
                    <>
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
                        <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                          {competencies[activeCompetencyIndex].name}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          {competencies[activeCompetencyIndex].description}
                        </p>
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Your Rating
                        </label>
                        <div className="flex items-center gap-2">
                          {proficiencyLevels.map((level) => (
                            <button
                              key={level.id}
                              type="button"
                              title={`${level.label}${level.description ? `: ${level.description}` : ''}`}
                              onClick={() => setCurrentRating(level.levelNumber)}
                              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                                currentRating === level.levelNumber
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              } hover:bg-blue-500 hover:text-white transition-colors`}
                            >
                              {level.levelNumber}
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {proficiencyLevels.map(level => `${level.levelNumber} = ${level.label}`).join(' · ')}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Comments (Optional)
                        </label>
                        <textarea
                          value={currentComments}
                          onChange={(e) => setCurrentComments(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          rows={4}
                          placeholder="Add your comments about this competency..."
                        ></textarea>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-between p-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeCompetencyIndex > 0) {
                        setActiveCompetencyIndex(activeCompetencyIndex - 1);
                        // Reset current rating for previous competency
                        setCurrentRating(0);
                        setCurrentComments('');
                      }
                    }}
                    disabled={activeCompetencyIndex === 0}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05] disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (currentRating === 0) {
                        setError('Please select a rating before continuing.');
                        return;
                      }
                      
                      await handleCompetencyRating(currentRating, currentComments);
                      setCurrentRating(0);
                      setCurrentComments('');
                    }}
                  disabled={loading}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </span>
                    ) : (
                      activeCompetencyIndex === competencies.length - 1 ? 'Finish' : 'Next'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Summary Modal */}
          {showSummaryModal && currentAssessment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
              <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-gray-900 max-h-[90vh] flex flex-col">
                <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Assessment Summary
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Review your assessment before submitting
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSummaryModal(false)}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Start Date</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(currentAssessment.createdAt)}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Progress</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{progress}%</p>
                    </div>
                    {currentDepartment && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Department</h3>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">{currentDepartment.name}</p>
                      </div>
                    )}
                    {currentJob && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Job Role</h3>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">{currentJob.title}</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Once you submit this assessment, it will be marked as completed and can no longer be edited.
                          Your assessor will be notified to review your self-assessment.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Competency Ratings</h3>
                    <div className="space-y-4">
                      {currentAssessment.ratings && currentAssessment.ratings.map((rating) => {
                        const competency = competencies.find(c => c.id === rating.competencyId);
                        return (
                          <div key={rating.competencyId} className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-medium text-gray-900 dark:text-white">{competency?.name || 'Unknown Competency'}</h4>
                              <div className="flex items-center">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">Rating:</span>
                                <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-1 rounded text-sm font-medium">
                                  {rating.rating}/{proficiencyLevels[proficiencyLevels.length - 1]?.levelNumber || '?'}
                                </span>
                              </div>
                            </div>
                            {rating.comment && (
                              <p className="text-gray-600 dark:text-gray-400 text-sm">{rating.comment}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setShowSummaryModal(false)}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitAssessment}
                    disabled={loading}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </span>
                    ) : (
                      "Submit Assessment"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Success Modal */}
          {showSuccessModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
              <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 text-center p-6">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">Assessment Completed!</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Your competency assessment has been successfully submitted and is now pending review by your assessor. 
                  You will be notified once your assessment has been reviewed.
                </p>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setShowSuccessModal(false)}
                    className="inline-flex w-full justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
