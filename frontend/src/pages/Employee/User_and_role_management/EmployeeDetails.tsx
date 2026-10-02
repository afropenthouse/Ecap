import React, { useState, useEffect } from 'react';
import { UserIcon, XMarkIcon, ClockIcon, PencilIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../../context/AuthContext';
import { getUserProfile, updateUser, uploadImage, getDepartments, listEmployeeJobAssignments, updateEmployeeDepartments, type Department } from '../../../api/services';

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
  onboardingCompleted?: boolean;
}

const EmployeeDetails: React.FC = () => {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [savedDepartmentIds, setSavedDepartmentIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch employee profile
  const fetchEmployeeProfile = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const [profile, allDepartments, assignments] = await Promise.all([
        getUserProfile(user.id),
        getDepartments(),
        listEmployeeJobAssignments({ employeeId: user.id })
      ]);

      // Derive departments from job assignments
      const deptMap = new Map<string, { id: string; name: string }>();
      assignments.forEach(a => {
        const dept = a.job?.department as { id: string; name: string } | null | undefined;
        if (dept && !deptMap.has(dept.id)) {
          deptMap.set(dept.id, { id: dept.id, name: dept.name });
        }
      });
      const employeeDepartments = Array.from(deptMap.values());

      const employeeData: Employee = {
        id: profile.id,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        profilePictureUrl: profile.profilePictureUrl,
        departmentIds: employeeDepartments.map(d => d.id),
        departments: employeeDepartments,
        isLockedUntil: profile.isLockedUntil ?? null,
        onboardingCompleted: profile.onboardingCompleted ?? false,
      };

      setEmployee(employeeData);
      setSavedDepartmentIds(employeeData.departmentIds);
      setDepartments(allDepartments);
      // Auto-open modal only when onboarding incomplete AND departments exist
      if (!employeeData.onboardingCompleted && allDepartments.length > 0) {
        setShowEditModal(true);
      }
    } catch (error) {
      console.error('Error fetching employee profile:', error);
      setError('Failed to load employee profile');
    } finally {
      setLoading(false);
    }
  };

  // Update employee profile
  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !user) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
        // Only require department selection if departments exist AND user hasn't completed onboarding
        if (!employee.onboardingCompleted && departments.length > 0 && (!employee.departmentIds || employee.departmentIds.length === 0)) {
          setError('Please select at least one department to complete your profile setup');
          setIsSubmitting(false);
          return;
        }

        let profilePictureUrl: string | undefined = undefined;
        if (avatarFile) {
          const result = await uploadImage(avatarFile, 'avatars');
          profilePictureUrl = result.url;
        }

        await updateUser(employee.id, {
          firstName: employee.firstName,
          lastName: employee.lastName,
          phone: employee.phone || '',
          profilePictureUrl,
        });

        // Only submit department changes when needed.
        const departmentsChanged = [...employee.departmentIds].sort().join(',') !== [...savedDepartmentIds].sort().join(',');
        if (!employee.onboardingCompleted || departmentsChanged) {
          await updateEmployeeDepartments(employee.id, { departmentIds: employee.departmentIds });
        }

        await fetchEmployeeProfile();
        setShowEditModal(false);
        setAvatarFile(null);
      } catch (error: any) {
        console.error('Error updating employee:', error);
        setError(error?.message || 'Failed to update employee');
      } finally {
        setIsSubmitting(false);
      }
  };

  useEffect(() => {
    if (user) {
      fetchEmployeeProfile();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-6 p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-200">
                Employee profile not found. Please contact HR.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Your account</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Employee Details</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage your personal information and view your assigned departments.</p>
        </div>
        {!employee.onboardingCompleted && <span className="inline-flex items-center gap-2 self-start rounded-full bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 sm:self-auto"><ClockIcon className="size-4" />Complete your profile setup</span>}
      </header>
      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Employee Profile */}
      <article className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="h-28 bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-600" />
        <div className="px-6 pb-7 sm:px-8">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              {employee.profilePictureUrl ? <img src={employee.profilePictureUrl} alt={`${employee.firstName} ${employee.lastName}`} className="size-24 rounded-2xl border-4 border-white object-cover shadow-md dark:border-gray-900" /> : <div className="flex size-24 items-center justify-center rounded-2xl border-4 border-white bg-blue-50 text-blue-600 shadow-md dark:border-gray-900 dark:bg-blue-950 dark:text-blue-300"><UserIcon className="size-12" /></div>}
              <div className="pb-1"><h2 className="text-xl font-bold text-gray-900 dark:text-white">{employee.firstName} {employee.lastName}</h2><span className="mt-1 inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">Employee</span></div>
            </div>
            <button type="button" onClick={() => setShowEditModal(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"><PencilIcon className="size-4" />Edit details</button>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/60"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Work email</p><p className="mt-2 break-all text-sm font-medium text-gray-900 dark:text-white">{employee.email}</p></div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/60"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Phone number</p><p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{employee.phone || 'Not provided'}</p></div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/60 sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Departments</p>{employee.departments.length ? <div className="mt-2 flex flex-wrap gap-2">{employee.departments.map(dept => <span key={`employee-dept-${dept.id}`} className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">{dept.name}</span>)}</div> : <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">No departments assigned</p>}</div>
          </div>
        </div>
      </article>
      {/* Edit Employee Modal */}
      {showEditModal && employee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[82vh] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-4 flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit your details</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update your contact information and departments.</p></div><button type="button" onClick={() => setShowEditModal(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close"><XMarkIcon className="size-5" /></button></div>
            <form onSubmit={handleUpdateEmployee} className="space-y-3">
              <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-300">First name<input required value={employee.firstName} onChange={e => setEmployee({ ...employee, firstName: e.target.value })} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white" /></label><label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-300">Last name<input required value={employee.lastName} onChange={e => setEmployee({ ...employee, lastName: e.target.value })} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white" /></label></div>
              <label className="block space-y-1 text-sm font-medium text-gray-700 dark:text-gray-300">Work email<input type="email" value={employee.email} disabled className="w-full rounded-xl border border-gray-200 bg-gray-100 px-3 py-2 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400" /><span className="text-xs font-normal text-gray-500">Email cannot be changed.</span></label>
              <label className="block space-y-1 text-sm font-medium text-gray-700 dark:text-gray-300">Phone number<input type="tel" value={employee.phone || ''} onChange={e => setEmployee({ ...employee, phone: e.target.value })} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white" /></label>
              <fieldset className="space-y-2"><legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Departments</legend>{departments.length ? <div className="grid max-h-32 gap-1 overflow-y-auto rounded-xl border border-gray-200 p-2 sm:grid-cols-2 dark:border-gray-700">{departments.map(dep => <label key={dep.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"><input type="checkbox" checked={employee.departmentIds.includes(dep.id)} onChange={e => setEmployee(prev => prev ? { ...prev, departmentIds: e.target.checked ? Array.from(new Set([...prev.departmentIds, dep.id])) : prev.departmentIds.filter(id => id !== dep.id) } : prev)} className="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /><span>{dep.name}</span></label>)}</div> : <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">No departments are available yet.</p>}<p className="text-xs text-gray-500 dark:text-gray-400">Choose at least one department to complete setup.</p></fieldset>
              <label className="block space-y-1 text-sm font-medium text-gray-700 dark:text-gray-300">Profile photo<input type="file" accept="image/jpeg,image/png" onChange={e => { const file = e.target.files?.[0]; if (file && !['image/jpeg', 'image/png'].includes(file.type)) { setError('Choose a JPEG or PNG photo.'); e.target.value = ''; return; } if (file && file.size > 2 * 1024 * 1024) { setError('Photo must be 2MB or smaller.'); e.target.value = ''; return; } setError(null); setAvatarFile(file || null); }} className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:font-semibold file:text-blue-700 dark:text-gray-300 dark:file:bg-blue-950 dark:file:text-blue-200" /><span className="text-xs font-normal text-gray-500 dark:text-gray-400">JPEG or PNG, up to 2MB.</span></label>
              {error && <p role="alert" className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800"><button type="button" onClick={() => setShowEditModal(false)} disabled={isSubmitting} className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">Cancel</button><button type="submit" disabled={isSubmitting} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{isSubmitting ? 'Savingâ€¦' : 'Save changes'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmployeeDetails;
