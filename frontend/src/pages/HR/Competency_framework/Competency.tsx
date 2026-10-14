import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { api } from '../../../api/client';
import { getCompetencies, getCategories, Competency as BackendCompetency, createCompetency, updateCompetency, deleteCompetency } from '../../../api/services';

interface BackendDomain { id: string; domainName: string }
interface BackendCategory { id: string; name: string; domain?: BackendDomain | null }

function Competency() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<BackendCompetency[]>([]);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<BackendCompetency | null>(null);
    const [formData, setFormData] = useState({ name: "", categoryId: "", description: "" });
    const [categories, setCategories] = useState<BackendCategory[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasAddedItem, setHasAddedItem] = useState(false);
    const [hasUpdatedItem, setHasUpdatedItem] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Add click outside handler
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('.actions-dropdown') && !target.closest('button')) {
          setActiveDropdown(null);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);

    // Add useEffect for fetching data
    useEffect(() => {
        fetchData();
        fetchCategoriesList();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const competencies = await getCompetencies();
            setData(competencies || []);
        } catch (error) {
            console.error('Error fetching competencies:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategoriesList = async () => {
        try {
            const cats = await getCategories();
            setCategories(cats || []);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const handleEdit = (item: BackendCompetency) => {
        setSelectedItem(item);
        setFormData({ name: item.name ?? "", categoryId: item.category?.id ?? "", description: item.description ?? "" });
        setShowAddModal(true);
        setHasUpdatedItem(false);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
    setError(null);
        if ((selectedItem && hasUpdatedItem) || (!selectedItem && hasAddedItem)) {
            alert("You have already " + (selectedItem ? "updated" : "added") + " this item. Please close this dialog and try again.");
            return;
        }

        try {
            if (selectedItem) {
                setIsUpdating(true);
                await updateCompetency(selectedItem.id, {
                    name: formData.name,
                    description: formData.description,
                    categoryId: formData.categoryId,
                });
                setHasUpdatedItem(true);
            } else {
                setIsAdding(true);
                await createCompetency({
                    name: formData.name,
                    description: formData.description,
                    categoryId: formData.categoryId,
                });
                setHasAddedItem(true);
            }

            const competencies = await getCompetencies();
            setData(competencies || []);
            setShowAddModal(false);
            setFormData({ name: "", categoryId: "", description: "" });
            setSelectedItem(null);
        } catch (error) {
            console.error('Error saving competency:', error);
            setError(error instanceof Error ? error.message : 'Failed to save competency');
        } finally {
            setIsAdding(false);
            setIsUpdating(false);
        }
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleDelete = (item: BackendCompetency) => {
        setSelectedItem(item);
        setShowDeleteModal(true);
        setError(null);
    };

    return (
      <div className="h-full overflow-auto p-6">
        {/* Header Section */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Competency Layout</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Manage organizational competencies</p>
          </div>
          <button
            onClick={() => {
              setSelectedItem(null);
              setFormData({ name: "", categoryId: "", description: "" });
              setShowAddModal(true);
              setHasAddedItem(false);
              setHasUpdatedItem(false);
            }}
            disabled={isAdding || isUpdating}
            className="flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            <span>{isAdding ? "Adding..." : "Add Competency"}</span>
          </button>
        </div>

        <div className="mb-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-8 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Competency Name
                </th>
                <th className="px-8 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Category
                </th>
                <th className="px-8 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Description
                </th>
                <th className="px-8 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : data.map((item) => (
                <tr key={`competency-${item.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap px-8 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {item.name}
                  </td>
                  <td className="whitespace-nowrap px-8 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {item.category?.name || (
                      <span className="text-gray-500 italic">Uncategorized</span>
                    )}
                  </td>
                  <td className="px-8 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {item.description || '-'}
                  </td>
                  <td className="whitespace-nowrap px-8 py-4 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setActiveDropdown(activeDropdown === item.id ? null : item.id)}
                        disabled={isAdding || isUpdating}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <span className="text-sm">Actions</span>
                        <ChevronDownIcon className="h-4 w-4" />
                      </button>

                      {activeDropdown === item.id && (
                        <div className={`actions-dropdown absolute right-0 z-[9999] w-36 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800 ${
                          item.id === data[data.length - 1].id ? 'bottom-full mb-1' : 'top-full mt-1'
                        }`}>
                          <div className="py-1">
                            <button
                              onClick={() => {
                                handleEdit(item);
                                setActiveDropdown(null);
                              }}
                              disabled={isAdding || isUpdating}
                              className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                              <PencilIcon className="mr-3 h-4 w-4 text-amber-500" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                handleDelete(item);
                                setActiveDropdown(null);
                              }}
                              disabled={isAdding || isUpdating}
                              className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-gray-700"
                            >
                              <TrashIcon className="mr-3 h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm dark:bg-gray-900/80" />
            <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
              <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {selectedItem ? "Edit Competency" : "Add New Competency"}
              </h2>
              <form onSubmit={handleSubmit}>
              {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Competency Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
                    placeholder="Enter competency name"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Category
                  </label>
                  <select
                    name="categoryId"
                    value={formData.categoryId}
                    onChange={handleFormChange}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}{cat.domain?.domainName ? ` (${cat.domain.domainName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleFormChange}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
                    placeholder="Enter competency description"
                    rows={4}
                    required
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setSelectedItem(null);
                      setFormData({ name: "", categoryId: "", description: "" });
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAdding || isUpdating}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  >
                    {selectedItem ? (isUpdating ? "Updating..." : "Update") : (isAdding ? "Adding..." : "Add")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm dark:bg-gray-900/80" />
            <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
              <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">Delete Competency</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Are you sure you want to delete "{selectedItem?.name}"? This action cannot be undone.</p>
              {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowDeleteModal(false); setSelectedItem(null); }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!selectedItem) return;
                    try {
                      setIsDeleting(true);
                      await deleteCompetency(selectedItem.id);
                      const competencies = await getCompetencies();
                      setData(competencies || []);
                      setShowDeleteModal(false);
                      setSelectedItem(null);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to delete competency');
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
       </div>
     );
   }
 
 export default Competency;