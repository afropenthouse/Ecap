import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { UserIcon } from "../../../icons";

import { listAssessorAssignments, listEmployeeJobAssignments, getJobs, type Job, type AssessorAssignment as BackendAssessorAssignment, type EmployeeJobAssignment as EmployeeJobRecord } from "../../../api/services";

// View model aligned to backend
type AssessorAssignmentView = {
  id: string;
  assessorName: string;
  jobTitle?: string;
  assignedAt?: string;
};

export default function EmployeeAssessorAssign() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssessorAssignmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchAssignment();
    }
  }, [user]);

  const fetchAssignment = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setError('You must be logged in to view your assigned assessor');
        setLoading(false);
        return;
      }

      // Fetch assignment - now includes assessor details from backend
      const assignmentsRecs = await listAssessorAssignments({ employeeId: user.id });
      const [jobsRecs, jobAssignRecs] = await Promise.all([
        getJobs(),
        listEmployeeJobAssignments({ employeeId: user.id }),
      ]);
      const latestJob: EmployeeJobRecord | undefined = jobAssignRecs[0];
      const job: Job | undefined = latestJob ? jobsRecs.find(j => j.id === latestJob.jobId) : undefined;

      setAssignments(assignmentsRecs.map((current: BackendAssessorAssignment) => ({
        id: current.id,
        assessorName: current.assessor
          ? `${current.assessor.firstName ?? ''} ${current.assessor.lastName ?? ''}`.trim() || current.assessor.email
          : current.assessorId,
        jobTitle: job?.title || undefined,
        assignedAt: latestJob?.startDate || latestJob?.createdAt,
      })));
      setLoading(false);
    } catch (err: any) {
      console.error("Error fetching assessor assignment:", err);
      setError(err?.message || 'Failed to load your assessor assignment. Please try again later.');
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header Section */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">My Assessor</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">View your assigned assessor</p>
        </div>
      </div>
      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="size-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading your assessor...</p>
        </div>
      )}
      {/* Error State */}
      {error && !loading && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/20">
          <div className="flex items-center">
            <UserIcon className="size-5 text-blue-600 dark:text-blue-400 mr-3" />
            <p className="text-gray-700 dark:text-gray-300">{error}</p>
          </div>
          <button
            onClick={fetchAssignment}
            className="mt-3 rounded-lg bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/40"
          >
            Try Again
          </button>
        </div>
      )}
      {/* Assessor Card */}
      {!loading && !error && assignments.length > 0 && (
        <div className="space-y-4">
        {assignments.map(assignment => (
        <div key={assignment.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="flex items-center mb-4 md:mb-0">
                <div className="flex size-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <UserIcon className="size-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{assignment.assessorName}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Your Assessor</p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assignment Details</h4>
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Job Role: </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{assignment.jobTitle ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Job assignment date: </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {assignment.assignedAt ? new Date(assignment.assignedAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        ))}
        </div>
      )}
      {/* No Assessor State */}
      {!loading && !error && assignments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <UserIcon className="size-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No assessor assigned yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            You don't have an assessor assigned to you yet
          </p>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Please contact HR to have an assessor assigned to you
          </p>
        </div>
      )}
    </div>
  );
}
