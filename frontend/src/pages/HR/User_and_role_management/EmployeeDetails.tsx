import React, { useState, useEffect } from 'react';
import { UserIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { listEmployees, type Department } from '../../../api/services';

interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  profilePictureUrl?: string | null;
  departmentIds: string[];
  departments: Department[];
  isLockedUntil?: string | null;
  role: 'EMPLOYEE' | 'ASSESSOR';
  isActive: boolean;
}

const EmployeeDetails: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'EMPLOYEE' | 'ASSESSOR'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Load organization people for the read-only directory.
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const employeesData = await listEmployees();
        setEmployees(employeesData.map(emp => ({
          id: emp.id,
          email: emp.email,
          firstName: emp.firstName,
          lastName: emp.lastName,
          phone: emp.phone,
          profilePictureUrl: emp.profilePictureUrl,
          departmentIds: emp.departmentIds || [],
          departments: emp.departments || [],
          isLockedUntil: emp.isLockedUntil,
          role: emp.role || 'EMPLOYEE',
          isActive: emp.isActive !== false,
        })));
      } catch (e: any) {
        console.error('Failed to load data', e);
        setError(e?.message || 'Failed to load employees');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // View employee
  const handleViewEmployee = (employeeId: string) => {
    const employeeToView = employees.find(emp => emp.id === employeeId);
    if (employeeToView) {
      setSelectedEmployee(employeeToView);
      setShowViewModal(true);
    }
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredEmployees = employees.filter(person => {
    const matchesRole = roleFilter === 'ALL' || person.role === roleFilter;
    const searchableText = `${person.firstName} ${person.lastName} ${person.email} ${person.phone || ''} ${person.departments.map(department => department.name).join(' ')}`.toLowerCase();
    return matchesRole && (!normalizedSearch || searchableText.includes(normalizedSearch));
  });
  const pageCount = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const visiblePage = Math.min(currentPage, pageCount);
  const pageEmployees = filteredEmployees.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);
  const activeCount = employees.filter(person => person.isActive).length;
  const employeeCount = employees.filter(person => person.role === 'EMPLOYEE' && person.isActive).length;
  const assessorCount = employees.filter(person => person.role === 'ASSESSOR' && person.isActive).length;

  useEffect(() => { setCurrentPage(1); }, [normalizedSearch, roleFilter]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">People directory</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Employee details</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Browse employees and assessors across your organization.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Active people', value: activeCount, tone: 'blue' },
          { label: 'Active employees', value: employeeCount, tone: 'violet' },
          { label: 'Active assessors', value: assessorCount, tone: 'emerald' },
        ].map(metric => <div key={metric.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{metric.label}</p>
          <p className={`mt-1 text-2xl font-bold ${metric.tone === 'blue' ? 'text-blue-700 dark:text-blue-300' : metric.tone === 'violet' ? 'text-violet-700 dark:text-violet-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{loading ? '—' : metric.value.toLocaleString()}</p>
        </div>)}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-md">
          <span className="sr-only">Search people</span>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400"><path fillRule="evenodd" d="M8.5 3a5.5 5.5 0 103.478 9.76l3.631 3.632a.75.75 0 101.06-1.061l-3.631-3.632A5.5 5.5 0 008.5 3zM4.5 8.5a4 4 0 117.999 0 4 4 0 01-7.999 0z" clipRule="evenodd" /></svg>
          <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search name, email, phone, department..." className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500" />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Filter by role">
          {([['ALL', 'Everyone'], ['EMPLOYEE', 'Employees'], ['ASSESSOR', 'Assessors']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setRoleFilter(value)} aria-pressed={roleFilter === value} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${roleFilter === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}>{label}</button>)}
        </div>
      </div>

      {loading ? <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-52 animate-pulse rounded-2xl bg-white dark:bg-gray-800" />)}</div> : filteredEmployees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300"><UserIcon className="size-7" /></div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">No people found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try another search or change the role filter.</p>
        </div>
      ) : <>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {pageEmployees.map(person => (
            <article key={person.id} className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-900">
              <div className="flex min-w-0 items-start gap-4">
                {person.profilePictureUrl ? <img src={person.profilePictureUrl} alt={`${person.firstName} ${person.lastName}`} className="size-14 shrink-0 rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-gray-700" /> : <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-lg font-bold text-blue-700 dark:from-blue-950 dark:to-indigo-950 dark:text-blue-200"><UserIcon className="size-7" /></div>}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="max-w-full truncate text-base font-bold text-gray-900 dark:text-white">{person.firstName} {person.lastName}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${person.role === 'ASSESSOR' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'}`}>{person.role === 'ASSESSOR' ? 'Assessor' : 'Employee'}</span>
                  </div>
                  <p className="mt-1 break-all text-sm text-gray-500 dark:text-gray-400">{person.email}</p>
                </div>
                <span aria-label={person.isActive ? 'Account active' : 'Account deactivated'} title={person.isActive ? 'Account active' : 'Account deactivated'} className={`mt-1 size-2.5 shrink-0 rounded-full ${person.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 dark:border-gray-800">
                <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Phone</p><p className="mt-1 truncate text-sm text-gray-700 dark:text-gray-200">{person.phone || 'Not provided'}</p></div>
                <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Departments</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {person.departments.slice(0, 2).map(department => <span key={`${person.id}-${department.id}`} className="max-w-full truncate rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">{department.name}</span>)}
                    {person.departments.length > 2 && <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">+{person.departments.length - 2}</span>}
                    {person.departments.length === 0 && <span className="text-sm text-gray-500 dark:text-gray-400">None assigned</span>}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                {!person.isActive && <span className="mr-auto text-xs font-medium text-gray-500 dark:text-gray-400">Deactivated</span>}
                <button onClick={() => handleViewEmployee(person.id)} className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40">View details</button>
              </div>
            </article>
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-gray-500 dark:text-gray-400">Showing {((visiblePage - 1) * pageSize) + 1}–{Math.min(visiblePage * pageSize, filteredEmployees.length)} of {filteredEmployees.length.toLocaleString()} people</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={visiblePage <= 1} onClick={() => setCurrentPage(visiblePage - 1)} className="rounded-lg border border-gray-200 px-3 py-2 font-medium text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200">Previous</button>
            <span className="px-2 text-gray-600 dark:text-gray-300">Page {visiblePage} of {pageCount}</span>
            <button type="button" disabled={visiblePage >= pageCount} onClick={() => setCurrentPage(visiblePage + 1)} className="rounded-lg border border-gray-200 px-3 py-2 font-medium text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200">Next</button>
          </div>
        </div>
      </>}

      {/* View Employee Modal */}
      {showViewModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedEmployee.role === 'ASSESSOR' ? 'Assessor details' : 'Employee details'}
                </h3>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="relative w-24 h-24">
                    {selectedEmployee.profilePictureUrl ? (
                      <img
                        src={selectedEmployee.profilePictureUrl}
                        alt={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <UserIcon className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                      First Name
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {selectedEmployee.firstName}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                      Last Name
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {selectedEmployee.lastName}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                      Email
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {selectedEmployee.email}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                      Phone Number
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {selectedEmployee.phone || 'Not provided'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                      Departments
                    </label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedEmployee.departments.map((dept) => (
                        <span
                          key={`view-dept-${dept.id}`}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        >
                          {dept.name}
                        </span>
                      ))}
                      {selectedEmployee.departments.length === 0 && (
                        <span className="text-xs text-gray-500">No departments assigned</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmployeeDetails;
