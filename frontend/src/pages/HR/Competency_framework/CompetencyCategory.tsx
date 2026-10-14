import { useState, useEffect } from "react";
import { getCategories, getDomains, createCategory, updateCategory, deleteCategory } from "../../../api/services";
import { 
  TrashBinIcon,
  InfoIcon,
  PencilIcon,
  ChevronDownIcon
} from "../../../icons";

interface BackendDomain {
  id: string;
  domainName: string;
}

interface BackendCategory {
  id: string;
  name: string;
  domain?: BackendDomain | null;
}

export default function CompetencyCategory() {
  const [data, setData] = useState<BackendCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BackendCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    domainId: ""
  });
  const [domains, setDomains] = useState<BackendDomain[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [filteredData, setFilteredData] = useState<BackendCategory[]>([]);

  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      setFilteredData(data);
      return;
    }
    const filtered = data.filter(item => {
      const nameMatch = item.name?.toLowerCase().includes(term);
      const domainMatch = item.domain?.domainName?.toLowerCase().includes(term) || false;
      return nameMatch || domainMatch;
    });
    setFilteredData(filtered);
  }, [searchTerm, data]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [categories, domainsList] = await Promise.all([
        getCategories(),
        getDomains(),
      ]);
      setData(categories || []);
      setFilteredData(categories || []);
      setDomains(domainsList || []);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
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

  const handleDelete = (item: BackendCategory) => {
    setSelectedItem(item);
    setShowDeleteModal(true);
  };

  const handleEdit = (item: BackendCategory) => {
    setSelectedItem(item);
    setFormData({ name: item.name, domainId: item.domain?.id ?? "" });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isAdding || isUpdating) return;
    
    try {
      if (selectedItem) {
        setIsUpdating(true);
        await updateCategory(selectedItem.id, { name: formData.name, domainId: formData.domainId });
      } else {
        setIsAdding(true);
        await createCategory({ name: formData.name, domainId: formData.domainId });
      }
      const categories = await getCategories();
      setData(categories || []);
      setFilteredData(categories || []);
      setShowAddModal(false);
      setFormData({ name: "", domainId: "" });
      setSelectedItem(null);
    } catch (err) {
      console.error("Error adding item:", err);
      const message = err instanceof Error ? err.message : 'Failed to save category';
      setError(message);
    } finally {
      setIsAdding(false);
      setIsUpdating(false);
    }
  };

  const toggleDropdown = (id: string) => {
    if (activeDropdown === id) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(id);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading competency categories...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={fetchData}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">Competency Category Layout</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Building a foundation of excellence through defined competencies</p>
        </div>
        <div className="flex justify-center sm:justify-end">
          <button 
            onClick={() => { setError(null); setSelectedItem(null); setFormData({ name: "", domainId: "" }); setShowAddModal(true); }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 w-full sm:w-auto"
          >
            <span>Add Category</span>
          </button>
        </div>
      </div>

      <div className="mb-6 relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <InfoIcon className="size-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white dark:placeholder-gray-400"
          placeholder="Search by category name or domain..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Category Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Domain
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  {searchTerm ? 'No categories found matching your search' : 'No categories available'}
                </td>
              </tr>
            ) : (
              filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {item.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {item.domain?.domainName || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="relative actions-dropdown">
                      <button
                        onClick={() => toggleDropdown(item.id)}
                        className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                      >
                        <span>Actions</span>
                        <ChevronDownIcon className="ml-1 size-4" />
                      </button>
                      {activeDropdown === item.id && (
                        <div className="absolute right-0 z-50 mt-2 w-36 origin-top-right rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-800 dark:bg-gray-900" style={{ position: 'fixed' }}>
                          <button
                            onClick={() => handleEdit(item)}
                            className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            <PencilIcon className="mr-2 size-4 text-amber-500" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
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
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm dark:bg-gray-900/80" />
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white">
              {selectedItem ? 'Edit Category' : 'Add New Category'}
            </h2>
            <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
              Create a new competency category linked to a domain
            </p>
            
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Category Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white"
                  placeholder="Enter category name"
                />
              </div>
              
              <div>
                <label htmlFor="domainId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Domain
                </label>
                <select
                  id="domainId"
                  value={formData.domainId}
                  onChange={(e) => setFormData({ ...formData, domainId: e.target.value })}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                >
                  <option value="" disabled>Select a domain</option>
                  {domains.map(d => (
                    <option key={d.id} value={d.id}>{d.domainName}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedItem(null);
                    setFormData({ name: "", domainId: "" });
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                  disabled={isAdding || isUpdating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isAdding || isUpdating}
                >
                  {(isAdding || isUpdating) ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      {selectedItem ? 'Saving...' : 'Adding...'}
                    </>
                  ) : (
                      selectedItem ? 'Save Changes' : 'Add Category'
                  )}
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
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Delete Category</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete "{selectedItem?.name}"? This action cannot be undone.
            </p>
            {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setSelectedItem(null); }}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedItem) return;
                  try {
                    setIsDeleting(true);
                    await deleteCategory(selectedItem.id);
                    const categories = await getCategories();
                    setData(categories || []);
                    setFilteredData(categories || []);
                    setShowDeleteModal(false);
                    setSelectedItem(null);
                  } catch (err) {
                    const message = err instanceof Error ? err.message : 'Failed to delete category';
                    setError(message);
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