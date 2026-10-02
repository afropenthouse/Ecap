import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  UserIcon,
  InfoIcon
} from "../../../icons";

import { listAssessorAssignments, listUsers, listEmployeeJobAssignments, getJobs, type UserSummary, type Job, type EmployeeJobAssignment as EmployeeJobRecord } from "../../../api/services";

interface AssignmentRow {
  id: string;
  employeeId: string;
  assessorId: string;
  employeeName: string;
  jobTitle?: string;
  createdAt?: string;
}

export default function EmployeeAssessorAssign() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (user) {
      fetchAssignments();
    }
  }, [user]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setError('You must be logged in to view your assigned employees');
        setLoading(false);
        return;
      }

      const [assignmentRecs, userRecs, jobAssignRecs, jobRecs] = await Promise.all([
        listAssessorAssignments({ assessorId: user.id }),
        listUsers(),
        listEmployeeJobAssignments(),
        getJobs(),
      ]);

      const usersById = new Map<string, UserSummary>(userRecs.map(u => [u.id, u]));
      const jobsById = new Map<string, Job>(jobRecs.map(j => [j.id, j]));

      // Choose latest job per employee (last seen in list)
      const latestJobByEmployee = new Map<string, EmployeeJobRecord>();
      for (const rec of jobAssignRecs) {
        latestJobByEmployee.set(rec.employeeId, rec);
      }

      const rows: AssignmentRow[] = assignmentRecs.map(a => {
        const emp = usersById.get(a.employeeId);
        const jobRec = latestJobByEmployee.get(a.employeeId);
        const job = jobRec ? jobsById.get(jobRec.jobId) : undefined;
        const employeeName = emp ? `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim() || emp.email : a.employeeId;
        return {
          id: a.id,
          employeeId: a.employeeId,
          assessorId: a.assessorId,
          employeeName,
          jobTitle: job?.title,
          createdAt: jobRec?.startDate,
        };
      });

      setAssignments(rows);
    } catch (err) {
      console.error("Error fetching assignments:", err);
      setError('Failed to load assessor assignments. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Filter assignments based on search term
  const filteredAssignments = assignments.filter(assignment =>
    assignment.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (assignment.jobTitle || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header Section */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">My Assigned Employees</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">View employees assigned to you for assessment</p>
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
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/20">
          <div className="flex items-center">
            <UserIcon className="size-5 text-blue-600 dark:text-blue-400 mr-3" />
            <p className="text-gray-700 dark:text-gray-300">{error}</p>
          </div>
          <button
            onClick={fetchAssignments}
            className="mt-3 rounded-lg bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/40"
          >
            Try Again
          </button>
        </div>
      )}
      {/* Assignments Table */}
      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Employee Details
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Job Role
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Assignment Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-white/[0.03]">
                {filteredAssignments.map((assignment) => (
                  <tr key={`assignment-${assignment.id}-${assignment.employeeName}`} className="hover:bg-gray-50 dark:hover:bg-white/[0.05]">
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center">
                        <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                          <UserIcon className="size-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-gray-900 dark:text-white">{assignment.employeeName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900 dark:text-white">
                      {assignment.jobTitle ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900 dark:text-white">
                      {assignment.createdAt ? new Date(assignment.createdAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Empty State */}
      {!loading && !error && filteredAssignments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <UserIcon className="size-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No assigned employees found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search' : 'You have no employees assigned to you yet'}
          </p>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Contact HR to have employees assigned to you
          </p>
        </div>
      )}
    </div>
  );
}
