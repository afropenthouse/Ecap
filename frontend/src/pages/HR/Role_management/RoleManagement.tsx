import { useState, useEffect, useCallback } from 'react';
import {
  UserIcon,
  BoxCubeIcon,
  TableIcon
} from "../../../icons";

// Import components
import UsersTab from './components/UsersTab';
import DepartmentsTab from './components/DepartmentsTab';
import JobRolesTab from './components/JobRolesTab';
import { listUsers, getDepartments, getJobs } from '../../../api/services';

// Types
interface User {
  id: string;
  email: string;
  roles: string[];
  firstName?: string | null;
  lastName?: string | null;
  accountStatus?: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'DEACTIVATED';
  isActive?: boolean;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
}

interface JobRole {
  id: string;
  name: string;
  description: string | null;
}

const RoleManagement: React.FC = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'jobRoles'>('users');

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState('');

  // Departments state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  // Job roles state
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [loadingJobRoles, setLoadingJobRoles] = useState(false);

  // Fetch users from backend
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const backendUsers = await listUsers();
      const normalized = backendUsers.map(u => ({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, roles: [u.role.toLowerCase()], accountStatus: u.accountStatus, isActive: u.isActive }));
      setUsers(normalized);
      setUsersError('');
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsersError(err instanceof Error ? err.message : 'Unable to refresh team members.');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load departments from backend
  const fetchDepartments = useCallback(async () => {
    setLoadingDepartments(true);
    try {
      const backendDepartments = await getDepartments();
      const normalized = (backendDepartments || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        description: d.description ?? '',
        created_at: d.created_at ?? d.createdAt ?? undefined,
      }));
      setDepartments(normalized);
    } catch (err) {
      setDepartments([]);
    } finally {
      setLoadingDepartments(false);
    }
  }, []);

  useEffect(() => {
    // Load users when the tab opens
    fetchUsers().catch(err => console.error('Initial users fetch failed:', err));
  }, []);

  useEffect(() => {
    // Load departments when the Departments tab becomes active
    if (activeTab === 'departments') {
      fetchDepartments().catch(err => console.error('Initial departments fetch failed:', err));
    }
    // Load job roles when the Job Roles tab becomes active
    if (activeTab === 'jobRoles') {
      fetchJobRoles().catch(err => console.error('Initial job roles fetch failed:', err));
    }
  }, [activeTab]);

  const fetchJobRoles = async () => {
    setLoadingJobRoles(true);
    try {
      const backendJobs = await getJobs();
      const normalized = (backendJobs || []).map(j => ({
        id: j.id,
        name: j.title,
        description: j.description ?? '',
      }));
      setJobRoles(normalized);
    } catch (err) {
      console.error('Failed to load job roles:', err);
      setJobRoles([]);
    } finally {
      setLoadingJobRoles(false);
    }
  };

  if (loadingUsers && loadingDepartments && loadingJobRoles) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="size-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-500"></div>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-w-0 w-full overflow-x-hidden overflow-y-auto p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">Role Management</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Manage users, departments, and job roles</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-800">
        <ul className="flex flex-wrap -mb-px text-sm font-medium text-center text-gray-500 dark:text-gray-300">
          <li className="mr-2">
            <button
              onClick={() => setActiveTab('users')}
              className={`inline-flex items-center justify-center p-4 rounded-t-lg ${
                activeTab === 'users'
                  ? 'text-blue-600 border-b-2 border-blue-600 dark:text-white dark:border-blue-500'
                  : 'hover:text-gray-600 hover:border-gray-300 dark:hover:text-white'
              }`}
            >
              <UserIcon className="mr-2 size-5" />
              Users
            </button>
          </li>
          <li className="mr-2">
            <button
              onClick={() => setActiveTab('departments')}
              className={`inline-flex items-center justify-center p-4 rounded-t-lg ${
                activeTab === 'departments'
                  ? 'text-blue-600 border-b-2 border-blue-600 dark:text-white dark:border-blue-500'
                  : 'hover:text-gray-600 hover:border-gray-300 dark:hover:text-white'
              }`}
            >
              <BoxCubeIcon className="mr-2 size-5" />
              Departments
            </button>
          </li>
          <li className="mr-2">
            <button
              onClick={() => setActiveTab('jobRoles')}
              className={`inline-flex items-center justify-center p-4 rounded-t-lg ${
                activeTab === 'jobRoles'
                  ? 'text-blue-600 border-b-2 border-blue-600 dark:text-white dark:border-blue-500'
                  : 'hover:text-gray-600 hover:border-gray-300 dark:hover:text-white'
              }`}
            >
              <TableIcon className="mr-2 size-5" />
              Job Roles
            </button>
          </li>
        </ul>
      </div>

      {/* Users Tab Content */}
      {activeTab === 'users' && (
        <UsersTab
          users={users}
          loadingUsers={loadingUsers}
          usersError={usersError}
          fetchUsers={fetchUsers}
        />
      )}

      {/* Departments Tab Content */}
      {activeTab === 'departments' && (
        <DepartmentsTab
          departments={departments}
          loadingDepartments={loadingDepartments}
          fetchDepartments={fetchDepartments}
          setDepartments={setDepartments}
        />
      )}

      {/* Job Roles Tab Content */}
      {activeTab === 'jobRoles' && (
        <JobRolesTab
          jobRoles={jobRoles}
          loadingJobRoles={loadingJobRoles}
          fetchJobRoles={fetchJobRoles}
          setJobRoles={setJobRoles}
        />
      )}

    </div>
  );
};

export default RoleManagement;
