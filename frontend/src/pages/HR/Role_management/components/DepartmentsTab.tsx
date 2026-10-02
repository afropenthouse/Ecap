import { useState, useEffect, useRef } from 'react';
import {
  TrashBinIcon,
  PencilIcon,
  ChevronDownIcon,
} from "../../../../icons";
import * as XLSX from 'xlsx';
import { createDepartment, updateDepartment, deleteDepartment } from '../../../../api/services';

interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at?: string;
}

interface DepartmentFormData {
  name: string;
  description: string;
}

interface DepartmentsTabProps {
  departments: Department[];
  loadingDepartments: boolean;
  fetchDepartments: () => Promise<void>;
  setDepartments: React.Dispatch<React.SetStateAction<Department[]>>;
}

export default function DepartmentsTab({ departments, loadingDepartments, fetchDepartments, setDepartments }: DepartmentsTabProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [departmentFormData, setDepartmentFormData] = useState<DepartmentFormData>({ name: '', description: '' });
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [showAddDepartmentModal, setShowAddDepartmentModal] = useState(false);
  const [showEditDepartmentModal, setShowEditDepartmentModal] = useState(false);
  const [showDeleteDepartmentModal, setShowDeleteDepartmentModal] = useState(false);
  const [isAddingDepartment, setIsAddingDepartment] = useState(false);
  const [isUpdatingDepartment, setIsUpdatingDepartment] = useState(false);
  const [isDeletingDepartment, setIsDeletingDepartment] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Create refs for dropdown menus
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Load departments via parent fetch when empty.
  useEffect(() => {
    if (departments.length === 0) {
      // Trigger parent fetch to load real backend departments
      fetchDepartments().catch(() => {});
    }
  }, [departments.length, fetchDepartments]);

  // Filter departments based on search query
  useEffect(() => {
    if (!departments) {
      setFilteredDepartments([]);
      return;
    }

    if (!searchQuery.trim()) {
      setFilteredDepartments([...departments]);
      return;
    }

    const filtered = departments.filter(
      dept =>
        dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dept.description && dept.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    setFilteredDepartments([...filtered]);
  }, [departments, searchQuery]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (activeDropdown) {
        const dropdownRef = dropdownRefs.current[activeDropdown];
        if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
          setActiveDropdown(null);
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeDropdown]);

  const toggleDropdown = (id: string) => {
    if (activeDropdown === id) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(id);
    }
  };

  // Add department
  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsAddingDepartment(true);
      setDepartmentError(null);

      if (!departmentFormData.name.trim()) {
        setDepartmentError('Department name is required');
        setIsAddingDepartment(false);
        return;
      }

      // Check for duplicate department names
      const duplicateDepartment = departments.find(
        dept => dept.name.toLowerCase() === departmentFormData.name.trim().toLowerCase()
      );

      if (duplicateDepartment) {
        setDepartmentError('A department with this name already exists');
        setIsAddingDepartment(false);
        return;
      }

      // Create on backend
      const created = await createDepartment({ name: departmentFormData.name.trim() });
      const newDepartment: Department = {
        id: created.id,
        name: created.name,
        description: departmentFormData.description.trim() ? departmentFormData.description.trim() : null,
        created_at: new Date().toISOString()
      };

      // Update local state
      setDepartments(prevDepartments => [...prevDepartments, newDepartment]);
      setFilteredDepartments(prevFiltered => [...prevFiltered, newDepartment]);

      // Clear form and close modal
      setShowAddDepartmentModal(false);
      setDepartmentFormData({ name: '', description: '' });
    } catch (error: any) {
      console.error('Error adding department:', error);
      setDepartmentError(error?.message || 'Failed to add department. Please try again.');
    } finally {
      setIsAddingDepartment(false);
    }
  };

  // Update department
  const handleUpdateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDepartment) return;

    try {
      setIsUpdatingDepartment(true);
      setDepartmentError(null);

      if (!departmentFormData.name.trim()) {
        setDepartmentError('Department name is required');
        setIsUpdatingDepartment(false);
        return;
      }

      // Check for duplicate department names (excluding current department)
      const duplicateDepartment = departments.find(
        dept => 
          dept.name.toLowerCase() === departmentFormData.name.trim().toLowerCase() &&
          dept.id !== selectedDepartment.id
      );

      if (duplicateDepartment) {
        setDepartmentError('A department with this name already exists');
        setIsUpdatingDepartment(false);
        return;
      }

      // Update on backend
      const updatedBackend = await updateDepartment(selectedDepartment.id, { name: departmentFormData.name.trim() });
      const updatedDepartment: Department = {
        ...selectedDepartment,
        id: updatedBackend.id,
        name: updatedBackend.name,
        description: departmentFormData.description.trim() || null
      };

      // Update local state
      setDepartments(prevDepartments =>
        prevDepartments.map(dept =>
          dept.id === selectedDepartment.id ? updatedDepartment : dept
        )
      );

      setFilteredDepartments(prevFiltered =>
        prevFiltered.map(dept =>
          dept.id === selectedDepartment.id ? updatedDepartment : dept
        )
      );

      setShowEditDepartmentModal(false);
      setSelectedDepartment(null);
    } catch (error: any) {
      console.error('Error updating department:', error);
      setDepartmentError(error?.message || 'Failed to update department. Please try again.');
    } finally {
      setIsUpdatingDepartment(false);
    }
  };

  // Delete department
  const handleDeleteDepartment = async () => {
    if (!selectedDepartment) return;

    try {
      setIsDeletingDepartment(true);

      await deleteDepartment(selectedDepartment.id);

      // Update local state
      setDepartments(prevDepartments =>
        prevDepartments.filter(dept => dept.id !== selectedDepartment.id)
      );

      setFilteredDepartments(prevFiltered =>
        prevFiltered.filter(dept => dept.id !== selectedDepartment.id)
      );

      setShowDeleteDepartmentModal(false);
      setSelectedDepartment(null);
    } catch (error: any) {
      console.error('Error deleting department:', error);
      setDepartmentError(error?.message || 'Failed to delete department. It may be in use by employees.');
    } finally {
      setIsDeletingDepartment(false);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) {
      setUploadError('Please select an Excel file to upload.');
      return;
    }

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (!validTypes.includes(file.type)) {
      setUploadError('Please upload a valid Excel file (.xlsx or .xls)');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError('File size should not exceed 5MB');
      return;
    }

    setUploadSuccessMessage(null);
    setUploadError(null);
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result;
      if (!result || !(result instanceof ArrayBuffer)) {
        setUploadError('Failed to read the file. Please try again.');
        setIsUploading(false);
        return;
      }

      try {
        const data = new Uint8Array(result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: (string | null)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Validate Excel structure
        if (jsonData.length < 2) {
          setUploadError('The Excel file must contain at least a header row and one data row.');
          setIsUploading(false);
          return;
        }

        // Validate headers
        const headers = jsonData[0];
        if (!headers || headers.length < 1 || headers[0] !== 'Name') {
          setUploadError('Invalid Excel format. The first column must be named "Name".');
          setIsUploading(false);
          return;
        }

        // Process and validate data rows
        const newDepartments = jsonData.slice(1).map((row, index) => {
          if (!row[0] || typeof row[0] !== 'string') {
            throw new Error(`Invalid department name in row ${index + 2}`);
          }
          return {
            id: Date.now().toString() + index, // Generate unique IDs
            name: row[0].trim(),
            description: row[1] ? String(row[1]).trim() : null,
            created_at: new Date().toISOString()
          };
        });

        // Validate department names
        const invalidNames = newDepartments.filter(dept => !dept.name || dept.name.length > 100);
        if (invalidNames.length > 0) {
          setUploadError('Department names must be between 1 and 100 characters.');
          setIsUploading(false);
          return;
        }

        // Check for duplicates in the file
        const names = newDepartments.map(dept => dept.name.toLowerCase());
        const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
        if (duplicates.length > 0) {
          setUploadError(`Duplicate department names found: ${duplicates.join(', ')}`);
          setIsUploading(false);
          return;
        }

        // Check for duplicates with existing departments
        const existingNames = departments.map(dept => dept.name.toLowerCase());
        const existingDuplicates = newDepartments.filter(dept => 
          existingNames.includes(dept.name.toLowerCase())
        );
        if (existingDuplicates.length > 0) {
          setUploadError(`Some departments already exist: ${existingDuplicates.map(d => d.name).join(', ')}`);
          setIsUploading(false);
          return;
        }

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Add new departments to state
        setDepartments(prev => [...prev, ...newDepartments]);
        setFilteredDepartments(prev => [...prev, ...newDepartments]);

        setUploadSuccessMessage(`${newDepartments.length} departments uploaded successfully!`);
      } catch (error: any) {
        console.error('Error processing the Excel file:', error);
        setUploadError(error.message || 'An error occurred while processing the Excel file.');
      } finally {
        setIsUploading(false);
      }
    };

    reader.onerror = () => {
      setUploadError('Failed to read the file. Please try again.');
      setIsUploading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        {/* Search Bar */}
        <div className="relative w-full sm:max-w-xs">
          <input
            type="text"
            placeholder="Search departments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white pl-3 pr-10 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg className="size-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Add Department Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => {
              setDepartmentFormData({ name: '', description: '' });
              setDepartmentError(null);
              setShowAddDepartmentModal(true);
            }}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Add Department
          </button>
          <label className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 cursor-pointer ml-2">
            {isUploading ? (
              <>
                <div className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Uploading...
              </>
            ) : (
              <>
                <svg className="mr-2 size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Excel
              </>
            )}
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleExcelUpload}
              className="hidden"
              disabled={isUploading}
            />
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th scope="col" className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">
                  Name
                </th>
                <th scope="col" className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">
                  Description
                </th>
                <th scope="col" className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-white/[0.03]">
              {loadingDepartments ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="size-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-500"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredDepartments.length > 0 ? (
                [...filteredDepartments]
                  .sort((a, b) => {
                    if (a.created_at && b.created_at) {
                      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    }
                    return a.id.localeCompare(b.id);
                  })
                  .map((department) => (
                  <tr key={department.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.05]">
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900 dark:text-white">
                      {department.name}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                      {department.description || 'No description'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium">
                      <div className="relative actions-dropdown">
                        <button
                          onClick={() => toggleDropdown(`dept-${department.id}`)}
                          className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                        >
                          Actions
                          <ChevronDownIcon className="ml-1 size-4" />
                        </button>

                        {activeDropdown === `dept-${department.id}` && (
                          <div
                            ref={(el) => {
                              dropdownRefs.current[`dept-${department.id}`] = el;
                              return undefined;
                            }}
                            className="absolute right-0 z-50 mt-2 w-36 origin-top-right rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-800 dark:bg-gray-900"
                          >
                            <button
                              onClick={() => {
                                setSelectedDepartment(department);
                                setDepartmentFormData({
                                  name: department.name,
                                  description: department.description || ''
                                });
                                setShowEditDepartmentModal(true);
                                setActiveDropdown(null);
                              }}
                              className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                              <PencilIcon className="mr-2 size-4 text-amber-500" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setSelectedDepartment(department);
                                setShowDeleteDepartmentModal(true);
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
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {searchQuery.trim()
                      ? `No departments found matching "${searchQuery}".`
                      : 'No departments found. Add a department to get started.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Department Modal */}
      {showAddDepartmentModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-24 pb-8">
          <div className="w-full max-w-md rounded-xl bg-white p-5 dark:bg-gray-900">
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white">Add Department</h2>
            <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
              Create a new department
            </p>

            {departmentError && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/20">
                <p className="text-red-600 dark:text-red-400">{departmentError}</p>
              </div>
            )}

            <form onSubmit={handleAddDepartment} className="mt-6 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Department Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={departmentFormData.name}
                  onChange={(e) => setDepartmentFormData({...departmentFormData, name: e.target.value})}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  id="description"
                  value={departmentFormData.description}
                  onChange={(e) => setDepartmentFormData({...departmentFormData, description: e.target.value})}
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddDepartmentModal(false)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                  disabled={isAddingDepartment}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  disabled={isAddingDepartment}
                >
                  {isAddingDepartment ? (
                    <>
                      <div className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Adding...
                    </>
                  ) : (
                    'Add Department'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Department Modal */}
      {showEditDepartmentModal && selectedDepartment && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-24 pb-8">
          <div className="w-full max-w-md rounded-xl bg-white p-5 dark:bg-gray-900">
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white">Edit Department</h2>
            <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
              Update department details
            </p>

            {departmentError && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/20">
                <p className="text-red-600 dark:text-red-400">{departmentError}</p>
              </div>
            )}

            <form onSubmit={handleUpdateDepartment} className="mt-6 space-y-4">
              <div>
                <label htmlFor="edit_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Department Name
                </label>
                <input
                  type="text"
                  id="edit_name"
                  value={departmentFormData.name}
                  onChange={(e) => setDepartmentFormData({...departmentFormData, name: e.target.value})}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="edit_description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  id="edit_description"
                  value={departmentFormData.description}
                  onChange={(e) => setDepartmentFormData({...departmentFormData, description: e.target.value})}
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditDepartmentModal(false)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                  disabled={isUpdatingDepartment}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  disabled={isUpdatingDepartment}
                >
                  {isUpdatingDepartment ? (
                    <>
                      <div className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Updating...
                    </>
                  ) : (
                    'Update Department'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Department Confirmation Modal */}
      {showDeleteDepartmentModal && selectedDepartment && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-24 pb-8">
          <div className="w-full max-w-md rounded-xl bg-white p-5 dark:bg-gray-900">
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white">Delete Department</h2>
            <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete the department "{selectedDepartment.name}"?
            </p>
            <p className="mt-2 text-center text-sm text-red-500">
              This action cannot be undone.
            </p>

            {departmentError && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/20">
                <p className="text-red-600 dark:text-red-400">{departmentError}</p>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteDepartmentModal(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                disabled={isDeletingDepartment}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDepartment}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                disabled={isDeletingDepartment}
              >
                {isDeletingDepartment ? (
                  <>
                    <div className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete Department'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Display success or error message */}
      {uploadSuccessMessage && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400">
          <div className="flex items-center">
            <svg className="mr-2 size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            {uploadSuccessMessage}
          </div>
        </div>
      )}

      {uploadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <div className="flex items-center">
            <svg className="mr-2 size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {uploadError}
          </div>
        </div>
      )}
    </div>
  );
}
