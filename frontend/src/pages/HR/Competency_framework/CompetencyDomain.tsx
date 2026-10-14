import React, { useState, useEffect } from "react";
import {
  TrashBinIcon,
  InfoIcon,
  PencilIcon,
  ChevronDownIcon
} from "../../../icons";
import { getDomains, createDomain, updateDomain, deleteDomain } from "../../../api/services";

interface CompetencyDomain {
  id: string;
  domain_name: string;
  created_at?: string;
}

export default function CompetencyDomain() {
  const [data, setData] = useState<CompetencyDomain[]>([]);
  const [filteredData, setFilteredData] = useState<CompetencyDomain[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CompetencyDomain | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    domain_name: ""
  });

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredData.slice(startIndex, endIndex);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const domains = await getDomains();
      const mapped = domains.map((d: any) => ({ 
        id: d.id, 
        domain_name: d.domainName,
        created_at: d.createdAt
      }));
      setData(mapped);
      setFilteredData(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const filtered = data.filter(item =>
      item.domain_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredData(filtered);
    setCurrentPage(1);
  }, [searchTerm, data]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isAdding || isUpdating) return;

    try {
      if (selectedItem) {
        setIsUpdating(true);
        await updateDomain(selectedItem.id, { domainName: formData.domain_name });
      } else {
        setIsAdding(true);
        await createDomain({ domainName: formData.domain_name });
      }

      await fetchData();
      setShowAddModal(false);
      setFormData({ domain_name: "" });
      setSelectedItem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsAdding(false);
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      setIsDeleting(true);
      await deleteDomain(selectedItem.id);
      await fetchData();
      setShowDeleteModal(false);
      setSelectedItem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (item: CompetencyDomain) => {
    setSelectedItem(item);
    setFormData({ domain_name: item.domain_name });
    setShowAddModal(true);
  };

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

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Competency Domains</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Manage organizational competency domains</p>
        </div>
        <button
          onClick={() => {
            setSelectedItem(null);
            setFormData({ domain_name: "" });
            setShowAddModal(true);
          }}
          disabled={isAdding || isUpdating || isDeleting}
          className="flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          <span>{isAdding ? "Adding..." : "Add Domain"}</span>
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-4 pr-11 text-sm shadow-sm placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
            placeholder="Search domains..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <InfoIcon className="absolute right-3 top-3 h-5 w-5 text-gray-400 dark:text-gray-500" />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mb-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-8 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Domain Name
              </th>
              <th className="px-8 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            {loading ? (
              <tr>
                <td colSpan={2} className="px-8 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : currentItems.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="whitespace-nowrap px-8 py-4 text-sm text-gray-900 dark:text-gray-100">
                  {item.domain_name}
                </td>
                <td className="whitespace-nowrap px-8 py-4 text-right">
                  <div className="relative inline-block">
                    <button
                      onClick={() => setActiveDropdown(
                        activeDropdown === item.id ? null : item.id
                      )}
                      disabled={isAdding || isUpdating || isDeleting}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <span className="text-sm">Actions</span>
                      <ChevronDownIcon className="h-4 w-4" />
                    </button>

                    {activeDropdown === item.id && (
                      <div className={`actions-dropdown absolute right-0 z-50 w-36 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800 ${
                        item.id === data[data.length - 1]?.id ? 'bottom-full mb-1' : 'top-full mt-1'
                      }`}>
                        <div className="py-1">
                          <button
                            onClick={() => {
                              handleEdit(item);
                              setActiveDropdown(null);
                            }}
                            disabled={isAdding || isUpdating || isDeleting}
                            className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            <PencilIcon className="mr-3 h-4 w-4 text-amber-500" />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setShowDeleteModal(true);
                              setActiveDropdown(null);
                            }}
                            disabled={isAdding || isUpdating || isDeleting}
                            className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-gray-700"
                          >
                            <TrashBinIcon className="mr-3 h-4 w-4" />
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

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm dark:bg-gray-900/80" />
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
              {selectedItem ? "Edit Domain" : "Add New Domain"}
            </h2>
            <form onSubmit={handleSubmit}>
              {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Domain Name
                </label>
                <input
                  type="text"
                  name="domain_name"
                  value={formData.domain_name}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
                  placeholder="Enter domain name"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedItem(null);
                    setFormData({ domain_name: "" });
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding || isUpdating || isDeleting}
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
            <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
              Delete Domain
            </h2>
            <p className="mb-6 text-gray-600 dark:text-gray-400">
              Are you sure you want to delete the domain "{selectedItem?.domain_name}"? This action cannot be undone.
            </p>
            {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedItem(null);
                }}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isAdding || isUpdating || isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredData.length)} of {filteredData.length} domains
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              Previous
            </button>
            <span className="rounded-lg bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200">
              {currentPage}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}