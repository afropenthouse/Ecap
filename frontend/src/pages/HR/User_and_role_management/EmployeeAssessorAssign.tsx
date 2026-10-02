import { useState, useEffect } from 'react';
import {
  UserIcon,
  PlusIcon,
  TrashBinIcon,
  InfoIcon,
  PencilIcon,
  ChevronDownIcon
} from "../../../icons";
import {
  listAssessorAssignments,
  createAssessorAssignment,
  updateAssessorAssignment,
  deleteAssessorAssignment,
  listUsers,
  getJobs,
  listEmployeeJobAssignments,
  type UserSummary,
  type Job,
  type EmployeeJobAssignment,
} from "../../../api/services";

interface AssignmentRow {
  id: string;
  employeeId: string;
  assessorId: string;
  employeeName: string;
  jobTitle: string;
  assessor: string;
  created_at?: string;
}

export default function EmployeeAssessorAssign() {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [jobAssignments, setJobAssignments] = useState<EmployeeJobAssignment[]>([]);
  const [assessors, setAssessors] = useState<UserSummary[]>([]);
  const [employees, setEmployees] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentRow | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedAssessor, setSelectedAssessor] = useState<string>("");
  const [formJobRole, setFormJobRole] = useState<string>("");


  // Load all initial data from backend
  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersRes, jobsRes, jobAssignRes, assignRes] = await Promise.all([
        listUsers(),
        getJobs(),
        listEmployeeJobAssignments(),
        listAssessorAssignments(),
      ]);

      setUsers(usersRes);
      setJobs(jobsRes);
      setJobAssignments(jobAssignRes);

      const employeesList = usersRes.filter(u => u.role === 'EMPLOYEE');
      const assessorsList = usersRes.filter(u => u.role === 'ASSESSOR');
      setEmployees(employeesList);
      setAssessors(assessorsList);

      const rows: AssignmentRow[] = assignRes.map((rec) => {
        const emp = usersRes.find(u => u.id === rec.employeeId);
        const ass = usersRes.find(u => u.id === rec.assessorId);
        const employeeJobAssignments = jobAssignRes
          .filter(ja => ja.employeeId === rec.employeeId)
          .sort((a, b) => {
            const ta = a.startDate ? new Date(a.startDate).getTime() : 0;
            const tb = b.startDate ? new Date(b.startDate).getTime() : 0;
            return tb - ta;
          });
        const jaForEmp = employeeJobAssignments[0];
        const job = jobsRes.find(j => j.id === jaForEmp?.jobId);
        return {
          id: rec.id,
          employeeId: rec.employeeId,
          assessorId: rec.assessorId,
          employeeName: `${emp?.firstName ?? ''} ${emp?.lastName ?? ''}`.trim(),
          jobTitle: job?.title ?? '',
          assessor: `${ass?.firstName ?? ''} ${ass?.lastName ?? ''}`.trim(),
        };
      });
      setAssignments(rows);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
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

  // Derive the job role when employee selection changes
  useEffect(() => {
    if (!selectedEmployee) {
      setFormJobRole("");
      return;
    }
    const employeeJobAssignments = jobAssignments
      .filter(ja => ja.employeeId === selectedEmployee)
      .sort((a, b) => {
        const ta = a.startDate ? new Date(a.startDate).getTime() : 0;
        const tb = b.startDate ? new Date(b.startDate).getTime() : 0;
        return tb - ta;
      });
    const jaForEmp = employeeJobAssignments[0];
    const job = jobs.find(j => j.id === jaForEmp?.jobId);
    setFormJobRole(job?.title ?? "");
  }, [selectedEmployee, jobAssignments, jobs]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setError(null);
      const assignRes = await listAssessorAssignments();
      const rows: AssignmentRow[] = assignRes.map((rec) => {
        const emp = users.find(u => u.id === rec.employeeId);
        const ass = users.find(u => u.id === rec.assessorId);
        const employeeJobAssignments = jobAssignments
          .filter(ja => ja.employeeId === rec.employeeId)
          .sort((a, b) => {
            const ta = a.startDate ? new Date(a.startDate).getTime() : 0;
            const tb = b.startDate ? new Date(b.startDate).getTime() : 0;
            return tb - ta;
          });
        const jaForEmp = employeeJobAssignments[0];
        const job = jobs.find(j => j.id === jaForEmp?.jobId);
        return {
          id: rec.id,
        employeeId: rec.employeeId,
        assessorId: rec.assessorId,
          employeeName: `${emp?.firstName ?? ''} ${emp?.lastName ?? ''}`.trim(),
          jobTitle: job?.title ?? '',
          assessor: `${ass?.firstName ?? ''} ${ass?.lastName ?? ''}`.trim(),
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
    (assignment.jobTitle ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.assessor.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);

      // Validate required fields
      if (!selectedEmployee || !selectedAssessor) {
        setError('Please select both employee and assessor');
        setIsSubmitting(false);
        return;
      }

      const created = await createAssessorAssignment({ assessorId: selectedAssessor, employeeId: selectedEmployee });

      const emp = users.find(u => u.id === created.employeeId);
      const ass = users.find(u => u.id === created.assessorId);
      const employeeJobAssignments = jobAssignments
        .filter(ja => ja.employeeId === created.employeeId)
        .sort((a, b) => {
          const ta = a.startDate ? new Date(a.startDate).getTime() : 0;
          const tb = b.startDate ? new Date(b.startDate).getTime() : 0;
          return tb - ta;
        });
      const jaForEmp = employeeJobAssignments[0];
      const job = jobs.find(j => j.id === jaForEmp?.jobId);
      const newRow: AssignmentRow = {
        id: created.id,
        employeeId: created.employeeId,
        assessorId: created.assessorId,
        employeeName: `${emp?.firstName ?? ''} ${emp?.lastName ?? ''}`.trim(),
        jobTitle: job?.title ?? '',
        assessor: `${ass?.firstName ?? ''} ${ass?.lastName ?? ''}`.trim(),
      };

      setAssignments([...assignments, newRow]);
      setShowAddModal(false);
      setSelectedEmployee("");
      setSelectedAssessor("");
      setFormJobRole("");
    } catch (err) {
      console.error("Error adding assignment:", err);
      setError('Failed to add assignment. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (assignment: AssignmentRow) => {
    setSelectedAssignment(assignment);

    setSelectedEmployee(assignment.employeeId);
    setSelectedAssessor(assignment.assessorId);

    // The job role is derived via the selected employee effect.
    setShowEditModal(true);
    setActiveDropdown(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAssignment) return;

    try {
      setIsSubmitting(true);

      // Validate required fields
      if (!selectedEmployee || !selectedAssessor) {
        setError('Please select both employee and assessor');
        setIsSubmitting(false);
        return;
      }

      const updated = await updateAssessorAssignment(selectedAssignment.id, {
        employeeId: selectedEmployee,
        assessorId: selectedAssessor,
      });

      const emp = users.find(u => u.id === updated.employeeId);
      const ass = users.find(u => u.id === updated.assessorId);
      const employeeJobAssignments = jobAssignments
        .filter(ja => ja.employeeId === updated.employeeId)
        .sort((a, b) => {
          const ta = a.startDate ? new Date(a.startDate).getTime() : 0;
          const tb = b.startDate ? new Date(b.startDate).getTime() : 0;
          return tb - ta;
        });
      const jaForEmp = employeeJobAssignments[0];
      const job = jobs.find(j => j.id === jaForEmp?.jobId);
      const updatedRow: AssignmentRow = {
        id: updated.id,
        employeeId: updated.employeeId,
        assessorId: updated.assessorId,
        employeeName: `${emp?.firstName ?? ''} ${emp?.lastName ?? ''}`.trim(),
        jobTitle: job?.title ?? '',
        assessor: `${ass?.firstName ?? ''} ${ass?.lastName ?? ''}`.trim(),
      };

      setAssignments(assignments.map(assignment =>
        assignment.id === selectedAssignment.id ? updatedRow : assignment
      ));
      setShowEditModal(false);
      setSelectedAssignment(null);
      setSelectedEmployee("");
      setSelectedAssessor("");
    } catch (err) {
      console.error("Error updating assignment:", err);
      setError('Failed to update assignment. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAssignment) return;

    try {
      setIsSubmitting(true);

      await deleteAssessorAssignment(selectedAssignment.id);

      setAssignments(assignments.filter(assignment => assignment.id !== selectedAssignment.id));
      setShowDeleteModal(false);
      setSelectedAssignment(null);
    } catch (err) {
      console.error("Error deleting assignment:", err);
      setError('Failed to delete assignment. Please try again later.');
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">Assign an Assessor</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Manage employee assessor assignments</p>
        </div>
        <div className="flex justify-center sm:justify-end">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 w-full sm:w-auto"
          >
            <PlusIcon className="size-4" />
            <span className="text-center items-center justify-center">Add Employee Assessor</span>
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
          placeholder="Search by employee, job role, or assessor..."
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
            onClick={loadAll}
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
                    Assessor
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-white/[0.03]">
                {filteredAssignments.map((assignment) => (
                  <tr key={`assessor-assignment-${assignment.id}`}
                    className="border-b hover:bg-gray-50 dark:hover:bg-white/[0.05]"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-sm text-gray-900 dark:text-white">{assignment.employeeName}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-sm text-gray-900 dark:text-white">{assignment.jobTitle}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-sm text-gray-900 dark:text-white">{assignment.assessor}</div>
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
            {searchTerm ? 'Try adjusting your search' : 'Create your first assessor assignment'}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <PlusIcon className="size-4" />
            Add Employee Assessor
          </button>
        </div>
      )}

      {/* Add Assignment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-24 pb-8">
          <div className="w-full max-w-md rounded-xl bg-white p-5 dark:bg-gray-900">
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white">New Assessor Assignment</h2>
            <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
              Create a new assessor assignment for an employee
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4 max-h-[70vh] overflow-y-auto pr-2 pl-1">
              <div>
                <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Employee
                </label>
                <select
                  id="employee_id"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white [&>option]:dark:bg-gray-900 [&>option]:dark:text-white"
                >
                  <option value="">Select an employee</option>
                  {employees.map(emp => (
                    <option key={`emp-${emp.id}`} value={emp.id}>
                      {(emp.firstName ?? '')} {(emp.lastName ?? '')} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="job_role_display" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Job Role
                </label>
                <input
                  id="job_role_display"
                  type="text"
                  value={formJobRole || ''}
                  readOnly
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Derived from latest job assignment</p>
              </div>

              <div>
                <label htmlFor="assessor_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Assessor
                </label>
                <select
                  id="assessor_id"
                  value={selectedAssessor}
                  onChange={(e) => setSelectedAssessor(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white [&>option]:dark:bg-gray-900 [&>option]:dark:text-white"
                >
                  <option value="">Select an assessor</option>
                  {assessors.map(assessor => (
                    <option key={`assessor-${assessor.id}`} value={assessor.id}>
                      {(assessor.firstName ?? '')} {(assessor.lastName ?? '')} ({assessor.email})
                    </option>
                  ))}
                </select>
                {assessors.length === 0 && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                    No assessors found. Please assign the assessor role to users first.
                  </p>
                )}
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
                    'Assign Assessor'
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
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white">Edit Assessor Assignment</h2>
            <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
              Update assessor assignment details
            </p>

            <form onSubmit={handleUpdate} className="mt-6 space-y-4 max-h-[70vh] overflow-y-auto pr-2 pl-1">
              <div>
                <label htmlFor="edit_employee_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Employee
                </label>
                <select
                  id="edit_employee_id"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white [&>option]:dark:bg-gray-900 [&>option]:dark:text-white"
                >
                  <option value="">Select an employee</option>
                  {employees.map(emp => (
                    <option key={`edit-emp-${emp.id}`} value={emp.id}>
                      {(emp.firstName ?? '')} {(emp.lastName ?? '')} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit_job_role_display" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Job Role
                </label>
                <input
                  id="edit_job_role_display"
                  type="text"
                  value={formJobRole || ''}
                  readOnly
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Derived from latest job assignment</p>
              </div>

              <div>
                <label htmlFor="edit_assessor_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Assessor
                </label>
                <select
                  id="edit_assessor_id"
                  value={selectedAssessor}
                  onChange={(e) => setSelectedAssessor(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white [&>option]:dark:bg-gray-900 [&>option]:dark:text-white"
                >
                  <option value="">Select an assessor</option>
                  {assessors.map(assessor => (
                    <option key={`edit-assessor-${assessor.id}`} value={assessor.id}>
                      {(assessor.firstName ?? '')} {(assessor.lastName ?? '')} ({assessor.email})
                    </option>
                  ))}
                </select>
                {assessors.length === 0 && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                    No assessors found. Please assign the assessor role to users first.
                  </p>
                )}
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
              Are you sure you want to delete this assessor assignment?
            </p>

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
                    Saving...
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
