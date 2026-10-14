import { useState, useEffect, useMemo } from 'react';
import {
  UserIcon,
  PlusIcon,
  TrashBinIcon,
  InfoIcon,
  PencilIcon,
  ChevronDownIcon
} from "../../../icons";

import {
  listUsers,
  getJobs,
  listEmployeeJobAssignments,
  createEmployeeJobAssignment,
  updateEmployeeJobAssignment,
  deleteEmployeeJobAssignment,
  type Job,
  type UserSummary,
  type EmployeeJobAssignment as EmployeeJobAssignmentRec,
} from "../../../api/services";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

type JobAssignmentRow = {
  id: string;
  employeeName: string;
  jobTitle: string;
  startDateRaw?: string;
  employeeId: string;
  jobId: string;
};

function assignmentRow(rec: EmployeeJobAssignmentRec, users: UserSummary[], jobs: Job[]): JobAssignmentRow {
  const user = rec.employee || users.find(user => user.id === rec.employeeId);
  const job = rec.job || jobs.find(job => job.id === rec.jobId);
  return { id: rec.id, employeeId: rec.employeeId, jobId: rec.jobId,
    employeeName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Unknown employee',
    jobTitle: job?.title || rec.jobId, startDateRaw: rec.startDate || undefined };
}

export default function EmployeeJobAssignment() {
  // Using JobAssignmentRow type defined above
  const [assignments, setAssignments] = useState<JobAssignmentRow[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<JobAssignmentRow | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  type AssignmentForm = {
    employee_id: string;
    job_id: string;
    start_date: string;
  };
  const [formData, setFormData] = useState<AssignmentForm>({
    employee_id: "",
    job_id: "",
    start_date: new Date().toISOString().split("T")[0],
  });

  const assignedJobIds = useMemo(() => new Set(assignments
    .filter(assignment => assignment.employeeId === formData.employee_id && (!showEditModal || assignment.id !== selectedAssignment?.id))
    .map(assignment => assignment.jobId)), [assignments, formData.employee_id, showEditModal, selectedAssignment?.id]);

  // Loading state for actions
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dropdown state
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  useEffect(() => {
    fetchAssignments();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.actions-dropdown')) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setError(null);

      const [assignRecs, userRecs, jobRecs] = await Promise.all([
        listEmployeeJobAssignments(),
        listUsers(),
        getJobs(),
      ]);

      const employeeUsers = userRecs.filter(u => u.role === 'EMPLOYEE');
      const userById = new Map(employeeUsers.map(u => [u.id, u]));
      const jobById = new Map(jobRecs.map(j => [j.id, j]));

      const rows: JobAssignmentRow[] = assignRecs.map(rec => {
        const user = userById.get(rec.employeeId);
        const job = jobById.get(rec.jobId);
        const nameOnly = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';
        return {
          id: rec.id,
          employeeName: nameOnly || 'Unnamed',
          jobTitle: job ? job.title : rec.jobId,
          startDateRaw: rec.startDate,
          employeeId: rec.employeeId,
          jobId: rec.jobId,
        };
      });

      setAssignments(rows);
      setUsers(employeeUsers.filter(user => user.isActive !== false));
      setJobs(jobRecs);
    } catch (err) {
      console.error('Error fetching assignments:', err);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      setFormError(null);

      if (!formData.employee_id || !formData.job_id) {
        throw new Error("Please select both employee and job role");
      }

      if (assignedJobIds.has(formData.job_id)) throw new Error('This job role is already assigned to this employee.');
      const created = await createEmployeeJobAssignment({
        employeeId: formData.employee_id,
        jobId: formData.job_id,
        startDate: formData.start_date,
      });

      setAssignments(previous => [assignmentRow(created, users, jobs), ...previous]);
      setShowAddModal(false);
      setFormData({
        employee_id: "",
        job_id: "",
        start_date: new Date().toISOString().split("T")[0],
      });
    } catch (err: any) {
      console.error("Error adding assignment:", err);
      setFormError(err.message || 'Failed to add assignment. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (assignment: JobAssignmentRow) => {
    setFormError(null);
    setSelectedAssignment(assignment);
    setFormData({
      employee_id: assignment.employeeId || "",
      job_id: assignment.jobId || "",
      start_date: (assignment.startDateRaw && assignment.startDateRaw.split('T')[0]) || '',
    });
    setShowEditModal(true);
    setActiveDropdown(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAssignment) return;

    try {
      setIsSubmitting(true);
      setFormError(null);

      if (!formData.employee_id || !formData.job_id) throw new Error('Please select both employee and job role');
      if (assignedJobIds.has(formData.job_id)) throw new Error('This job role is already assigned to this employee.');
      const updated = await updateEmployeeJobAssignment(selectedAssignment.id, {
        employeeId: formData.employee_id || undefined,
        jobId: formData.job_id || undefined,
        startDate: formData.start_date || null,
      });

      await fetchAssignments();
      setShowEditModal(false);
      setSelectedAssignment(null);
    } catch (err: any) {
      console.error("Error updating assignment:", err);
      setFormError(err.message || 'Failed to update assignment. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAssignment) return;

    try {
      setIsSubmitting(true);
      setFormError(null);

      await deleteEmployeeJobAssignment(selectedAssignment.id);

      await fetchAssignments();
      setShowDeleteModal(false);
      setSelectedAssignment(null);
    } catch (err: any) {
      console.error("Error deleting assignment:", err);
      setFormError(err.message || 'Failed to delete assignment. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDropdown = (id: string) => {
    if (activeDropdown === id) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(id);
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header Section */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">Assign Job Roles</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Manage employee job assignments and roles</p>
        </div>
        <div className="flex justify-center sm:justify-end">
          <button
            onClick={() => { setFormError(null); setFormData({ employee_id: '', job_id: '', start_date: new Date().toISOString().split('T')[0] }); setShowAddModal(true); }}
            disabled={loading || !!error}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 w-full sm:w-auto"
          >
            <PlusIcon className="size-0" />
            <span className="text-center items-center justify-center">Assign Job Roles</span>
          </button>
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
                    Start Date
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-white/[0.03]">
                {filteredAssignments.map((assignment) => (
                  <tr key={`job-assignment-${assignment.id}`} className="hover:bg-gray-50 dark:hover:bg-white/[0.05]">
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
                      {assignment.jobTitle}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {assignment.startDateRaw ? formatDate(assignment.startDateRaw) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium">
                      <div className="relative actions-dropdown">
                        <button
                          onClick={() => toggleDropdown(assignment.id)}
                          className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                        >
                          Actions
                          <ChevronDownIcon className="ml-1 size-4" />
                        </button>

                        {activeDropdown === assignment.id && (
                          <div className="absolute right-0 z-50 mt-2 w-36 origin-top-right rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-800 dark:bg-gray-900" style={{ position: 'fixed' }}>
                            <button
                              onClick={() => handleEdit(assignment)}
                              className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                              <PencilIcon className="mr-2 size-4 text-amber-500" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAssignment(assignment);
                                setFormError(null);
                                setShowDeleteModal(true);
                                setActiveDropdown(null);
                              }}
                              className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                              <TrashBinIcon className="mr-2 size-4 text-red-500" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
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
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No assignments found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search' : 'Create your first job assignment'}
          </p>
          <button
            onClick={() => { setFormError(null); setFormData({ employee_id: '', job_id: '', start_date: new Date().toISOString().split('T')[0] }); setShowAddModal(true); }}
            disabled={loading || !!error}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <PlusIcon className="size-0" />
            Assign Job Roles
          </button>
        </div>
      )}

      {/* Add Assignment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-24 pb-8">
          <div className="w-full max-w-md rounded-xl bg-white p-5 dark:bg-gray-900">
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white">New Job Assignment</h2>
            <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
              Create a new job assignment for an employee
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4 max-h-[70vh] overflow-y-auto pr-2 pl-1">
              {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{formError}</p>}
              <div>
                <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select Employee
                </label>
                <select
                  id="employee_id"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value, job_id: "" })}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white [&>option]:dark:bg-gray-900 [&>option]:dark:text-white"
                >
                  <option value="">Select an employee</option>
                  {users.map(user => (
                    <option key={`user-${user.id}`} value={user.id}>
                      {(`${user.firstName ?? ''} ${user.lastName ?? ''}`).trim() || 'Unnamed'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="job_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Job Role
                </label>
                <select
                  id="job_id"
                  value={formData.job_id}
                  onChange={(e) => setFormData({ ...formData, job_id: e.target.value })}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white [&>option]:dark:bg-gray-900 [&>option]:dark:text-white"
                >
                  <option value="">Select a job role</option>
                  {jobs.map(job => (
                    <option key={`job-${job.id}`} value={job.id} disabled={assignedJobIds.has(job.id)}>{job.title}{assignedJobIds.has(job.id) ? ' (already assigned)' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Start Date
                </label>
                <input
                  type="date"
                  id="start_date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white [&>option]:dark:bg-gray-900 [&>option]:dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Leave blank for an assignment without a start date. Future dates take effect on that date.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    'Assign Job Role'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {showEditModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-24 pb-8">
          <div className="w-full max-w-md rounded-xl bg-white p-5 dark:bg-gray-900">
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white">Edit Job Assignment</h2>
            <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
              Update job assignment details
            </p>

            <form onSubmit={handleUpdate} className="mt-6 space-y-4 max-h-[70vh] overflow-y-auto pr-2 pl-1">
              {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{formError}</p>}
              <div>
                <label htmlFor="edit_employee_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select Employee
                </label>
                <select
                  id="edit_employee_id"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value, job_id: "" })}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white [&>option]:dark:bg-gray-900 [&>option]:dark:text-white"
                >
                  <option value="">Select an employee</option>
                  {users.map(user => (
                    <option key={`edit-user-${user.id}`} value={user.id}>
                      {(`${user.firstName ?? ''} ${user.lastName ?? ''}`).trim() || 'Unnamed'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit_job_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Job Role
                </label>
                <select
                  id="edit_job_id"
                  value={formData.job_id}
                  onChange={(e) => setFormData({ ...formData, job_id: e.target.value })}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white [&>option]:dark:bg-gray-900 [&>option]:dark:text-white"
                >
                  <option value="">Select a job role</option>
                  {jobs.map(job => (
                    <option key={`job-${job.id}`} value={job.id} disabled={assignedJobIds.has(job.id)}>{job.title}{assignedJobIds.has(job.id) ? ' (already assigned)' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit_start_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Start Date
                </label>
                <input
                  type="date"
                  id="edit_start_date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white [&>option]:dark:bg-gray-900 [&>option]:dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Leave blank for an assignment without a start date. Future dates take effect on that date.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    'Update Assignment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-24 pb-8">
          <div className="w-full max-w-xs rounded-xl bg-white p-5 dark:bg-gray-900">
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white">Delete Assignment</h2>
            <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete this job assignment?
            </p>

            {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{formError}</p>}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}