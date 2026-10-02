import { useState, useEffect } from 'react';
import { UserIcon, PlusIcon, InfoIcon } from "../../../icons";
import { getProficiencyLevels, createProficiencyLevel, updateProficiencyLevel, deleteProficiencyLevel, ProficiencyLevel } from "../../../api/services";


export default function CompetencyProficiency() {
  const [levels, setLevels] = useState<ProficiencyLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState<{ levelNumber: number; label: string; description: string }>({
    levelNumber: 0,
    label: "",
    description: ""
  });
  const [isAdding, setIsAdding] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<ProficiencyLevel | null>(null);

  useEffect(() => {
    const fetchLevels = async () => {
      try {
        setLoading(true);
        const resp = await getProficiencyLevels();
        const data = (resp as ProficiencyLevel[]) || [];
        setLevels([...data].sort((a, b) => a.levelNumber - b.levelNumber));
      } catch (err) {
        console.error("Error fetching proficiency levels:", err);
        setError('Failed to load proficiency levels. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchLevels();
  }, []);

  const filteredLevels = levels.filter((l) => {
    const q = searchTerm.toLowerCase();
    return (
      l.label.toLowerCase().includes(q) ||
      (l.description || '').toLowerCase().includes(q) ||
      String(l.levelNumber).includes(q)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsAdding(true);
      if (!formData.label.trim() || formData.levelNumber <= 0) {
        setError('Please provide a valid level number and label.');
        return;
      }
      const payload = { levelNumber: formData.levelNumber, label: formData.label.trim(), description: formData.description.trim() || undefined };
      if (selectedLevel) {
        await updateProficiencyLevel(selectedLevel.id, payload);
        setLevels(levels.map(level => level.id === selectedLevel.id ? { ...level, ...payload } : level).sort((a, b) => a.levelNumber - b.levelNumber));
      } else {
        const created = await createProficiencyLevel(payload);
        setLevels([...levels, created as ProficiencyLevel].sort((a, b) => a.levelNumber - b.levelNumber));
      }
      setShowAddModal(false);
      setSelectedLevel(null);
      setFormData({ levelNumber: 0, label: "", description: "" });
    } catch (err) {
      console.error("Error adding proficiency level:", err);
      setError(err instanceof Error ? err.message : 'Failed to save proficiency level. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const openEdit = (level: ProficiencyLevel) => {
    setSelectedLevel(level);
    setFormData({ levelNumber: level.levelNumber, label: level.label, description: level.description || "" });
    setShowAddModal(true);
  };

  const handleDelete = async (level: ProficiencyLevel) => {
    if (!window.confirm(`Delete proficiency level "${level.label}"?`)) return;
    try {
      await deleteProficiencyLevel(level.id);
      setLevels(levels.filter(item => item.id !== level.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this level. It may be in use.");
    }
  };

  
  

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header Section */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">Proficiency Levels</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Manage standard proficiency levels and descriptions</p>
        </div>
        <div className="flex justify-center sm:justify-end">
          <button 
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 w-full sm:w-auto"
          >
            <PlusIcon className="size-0" />
            <span className="text-center items-center justify-center">Add Level</span>
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
          placeholder="Search by label or level number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-400">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="mt-2 rounded-lg bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/40"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Proficiencies Table */}
      {!loading && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Level</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Label</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Description</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-white/[0.03]">
                {filteredLevels.map((level) => (
                  <tr key={`level-${level.id}`} className="hover:bg-gray-50 dark:hover:bg-white/[0.05]">
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900 dark:text-white">{level.levelNumber}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center">
                        <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                          <UserIcon className="size-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-gray-900 dark:text-white">{level.label}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{level.description || ''}</td>
                    <td className="px-4 py-4 text-right text-sm"><button onClick={() => openEdit(level)} className="mr-3 font-medium text-blue-600 hover:underline">Edit</button><button onClick={() => handleDelete(level)} className="font-medium text-red-600 hover:underline">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredLevels.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <UserIcon className="size-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No levels found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search' : 'Create your first proficiency level'}
          </p>
          <button 
                  onClick={() => { setSelectedLevel(null); setFormData({ levelNumber: 0, label: "", description: "" }); setShowAddModal(true); }}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <PlusIcon className="size-0" />
            Add Level
          </button>
        </div>
      )}

      {/* Add Proficiency Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm dark:bg-gray-900/80" />
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white">{selectedLevel ? "Edit Proficiency Level" : "New Proficiency Level"}</h2>
            <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">{selectedLevel ? "Update this organisation proficiency level" : "Create a new proficiency level"}</p>
            
            <form onSubmit={handleSubmit} className="mt-6 space-y-4 max-h-[70vh] overflow-y-auto pr-2 pl-1">
              <div>
                <label htmlFor="level_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Level Number</label>
                <input
                  type="number"
                  id="level_number"
                  value={formData.levelNumber}
                  onChange={(e) => setFormData({ ...formData, levelNumber: Number(e.target.value) })}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
              
              <div>
                <label htmlFor="label" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Label</label>
                <input
                  type="text"
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
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
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white"
                  rows={4}
                />
              </div>
              
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setSelectedLevel(null); }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                  disabled={isAdding}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  disabled={isAdding}
                >
                  {isAdding ? (
                    <>
                      <div className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Adding...
                    </>
                  ) : (
                    selectedLevel ? 'Save Changes' : 'Add Level'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
