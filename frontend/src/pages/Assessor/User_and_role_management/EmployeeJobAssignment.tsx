import { useState, useEffect } from 'react';
import {
  UserIcon,
  InfoIcon
} from "../../../icons";

import { listEmployeeJobAssignments } from "../../../api/services";

// Format date for display
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Replace legacy mock-based interface with backend-mapped row type
type JobAssignmentRow = {
  id: string;
  employeeName: string;
  jobTitle: string;
  startDateRaw?: string;
  employeeId: string;
  jobId: string;
};

export default function EmployeeJobAssignment() {
  // Backend-driven state
  const [assignments, setAssignments] = useState<JobAssignmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setError(null);

      const assignRecs = await listEmployeeJobAssignments();

      const rows: JobAssignmentRow[] = assignRecs.map(rec => {
        const employeeName = rec.employee
          ? `${rec.employee.firstName ?? ''} ${rec.employee.lastName ?? ''}`.trim() || rec.employee.email
          : rec.employeeId;
        return {
          id: rec.id,
          employeeName,
          jobTitle: rec.job?.title ?? rec.jobId,
          startDateRaw: rec.startDate,
          employeeId: rec.employeeId,
          jobId: rec.jobId,
        };
      });

      setAssignments(rows);
    } catch (err) {
      console.error("Error fetching assignments:", err);
      setError('Failed to load job assignments. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Filter assignments based on search term
  const filteredAssignments = assignments.filter(assignment =>
    assignment.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.jobTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header Section */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">Employee Job Assignments</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">View all employee job assignments</p>
        </div>
      </div>
      {/* Search Bar */}
      <div className="mb-6 relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <InfoIcon className="size-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white dark:placeholder-gray-400"
          placeholder="Search by employee or job role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="size-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading assignments...</p>
        </div>
      )}
      {/* Error State */}
      {error && !loading && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={fetchAssignments}
            className="mt-2 rounded-lg bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/40"
          >
            Try Again
          </button>
        </div>
      )}
      {/* Assignments Cards */}
      {!loading && !error && filteredAssignments.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAssignments.map((assignment) => (
            <div
              key={`job-assignment-${assignment.id}-${assignment.employeeName}`}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-white/[0.03]"
            >
              <div className="bg-blue-50 dark:bg-blue-900/20 px-5 py-3 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Job Assignment</h3>
              </div>
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <UserIcon className="size-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{assignment.employeeName}</h3>
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Job Role</h4>
                    <p className="text-sm text-gray-900 dark:text-white">{assignment.jobTitle}</p>
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Start Date</h4>
                    <p className="text-sm text-gray-900 dark:text-white">{assignment.startDateRaw ? new Date(assignment.startDateRaw).toLocaleDateString() : '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Empty State */}
      {!loading && !error && filteredAssignments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <UserIcon className="size-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No assignments found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search' : 'No job assignments available'}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="mt-4 rounded-lg bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/40"
            >
              Clear Search
            </button>
          )}
        </div>
      )}
    </div>
  );
}
