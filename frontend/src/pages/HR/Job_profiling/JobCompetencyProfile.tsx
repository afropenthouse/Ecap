import { useState, useEffect, useRef } from 'react';
import {
  PencilIcon,
  TrashBinIcon,
  ChevronDownIcon,
} from "../../../icons";
import { getJobs, getCompetencies, getProficiencyLevels, addJobRequirement, updateJobRequirement, deleteJobRequirement } from '../../../api/services';

interface JobCompetencyProfile {
  id: string;
  jobId: string;
  competencyId: string;
  requiredLevel: number;
  job: {
    id: string;
    title: string;
  };
  competency: {
    id: string;
    name: string;
  };
  proficiencyLevel?: {
    id: number;
    name: string;
  };
}

interface Job {
  id: string;
  title: string;
  requirements?: any[];
}

interface Competency {
  id: string;
  name: string;
}

interface ProficiencyLevel {
  levelNumber: number;
  label: string;
}

interface FormData {
  jobId: string;
  competencyId: string;
  requiredLevel: number;
}

export default function JobCompetencyProfile() {
  const [profiles, setProfiles] = useState<JobCompetencyProfile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [proficiencyLevels, setProficiencyLevels] = useState<ProficiencyLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<JobCompetencyProfile | null>(null);
  const [formData, setFormData] = useState<FormData>({
    jobId: "",
    competencyId: "",
    requiredLevel: 0
  });
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Fetch all data on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [jobsResp, competenciesResp, levelsResp] = await Promise.all([
        getJobs(),
        getCompetencies(),
        getProficiencyLevels(),
      ]);

      const jobsData = Array.isArray(jobsResp) ? jobsResp : [];
      const competenciesData = Array.isArray(competenciesResp) ? competenciesResp : [];
      const levelsData = Array.isArray(levelsResp) ? levelsResp : [];

      // Build profiles from jobs and their requirements
      const enhancedProfiles: JobCompetencyProfile[] = [];
      jobsData.forEach((job: Job) => {
        job.requirements?.forEach((req: any) => {
          const competency = competenciesData.find((c: Competency) => c.id === req.competencyId);
          const level = levelsData.find((l: ProficiencyLevel) => l.levelNumber === req.requiredLevel);
          
          enhancedProfiles.push({
            id: req.id,
            jobId: job.id,
            competencyId: req.competencyId,
            requiredLevel: req.requiredLevel,
            job: { id: job.id, title: job.title },
            competency: {
              id: competency?.id || req.competencyId,
              name: competency?.name || 'Unknown Competency'
            },
            proficiencyLevel: level ? { id: level.levelNumber, name: level.label } : undefined
          });
        });
      });

      setProfiles(enhancedProfiles);
      setJobs(jobsData);
      setCompetencies(competenciesData);
      setProficiencyLevels(levelsData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: FormData) => ({
      ...prev,
      [name]: name === 'requiredLevel' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation for required fields
    if (!formData.jobId || !formData.competencyId || !formData.requiredLevel) {
      setError('Please select job, competency, and proficiency level');
      return;
    }
    try {
      setError(null);
      if (selectedProfile) {
        setIsUpdating(true);
        await updateJobRequirement(selectedProfile.jobId, selectedProfile.id, {
          competencyId: formData.competencyId,
          requiredLevel: formData.requiredLevel,
        });
        setShowEditModal(false);
      } else {
        setIsAdding(true);
        // Check for duplicate
        const duplicate = profiles.find(
          (p) => p.jobId === formData.jobId && p.competencyId === formData.competencyId
        );
        if (duplicate) {
          setError('This job-competency combination already exists.');
          setIsAdding(false);
          return;
        }
        await addJobRequirement(formData.jobId, {
          competencyId: formData.competencyId,
          requiredLevel: formData.requiredLevel,
        });
        setShowAddModal(false);
      }

      await fetchAllData();
      setSelectedProfile(null);
      setFormData({ jobId: "", competencyId: "", requiredLevel: 0 });
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to save profile. Please try again later.');
    } finally {
      setIsAdding(false);
      setIsUpdating(false);
    }
  };

  const handleEdit = (profile: JobCompetencyProfile) => {
    setSelectedProfile(profile);
    setFormData({
      jobId: profile.jobId,
      competencyId: profile.competencyId,
      requiredLevel: profile.requiredLevel
    });
    setShowEditModal(true);
    setActiveDropdown(null);
  };

  const handleDelete = async () => {
    if (!selectedProfile) return;
    
    try {
      setIsDeleting(true);
      await deleteJobRequirement(selectedProfile.jobId, selectedProfile.id);
      await fetchAllData();
      setShowDeleteModal(false);
      setSelectedProfile(null);
    } catch (err: any) {
      console.error('Error deleting profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete profile. Please try again later.');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleDropdown = (id: string) => {
    if (activeDropdown === id) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(id);
    }
  };

  // Filter profiles based on search term
  const filteredProfiles = profiles.filter(profile =>
    profile.job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.competency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (profile.proficiencyLevel?.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header Section */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">Job Competency Profiles</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Manage job competency profiles and their required proficiency levels</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Add Profile
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative">
        <input
          type="text"
          className="block w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white dark:placeholder-gray-400"
          placeholder="Search by job title, competency, or proficiency level..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="size-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading profiles...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Profiles Table */}
      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th scope="col" className="w-1/5 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Job Title
                  </th>
                  <th scope="col" className="w-1/5 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Competency
                  </th>
                  <th scope="col" className="w-2/5 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Required Proficiency Level
                  </th>
                  <th scope="col" className="w-1/5 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-white/[0.03]">
                {filteredProfiles.map((profile) => (
                  <tr key={`profile-${profile.id}`} className="hover:bg-gray-50 dark:hover:bg-white/[0.05]">
                    <td className="break-words px-4 py-4 text-sm text-gray-900 dark:text-white">
                      {profile.job.title}
                    </td>
                    <td className="break-words px-4 py-4 text-sm text-gray-900 dark:text-white">
                      {profile.competency.name}
                    </td>
                    <td className="break-words px-4 py-4 text-center text-sm text-gray-900 dark:text-white">
                      {profile.proficiencyLevel?.name || `Level ${profile.requiredLevel}`}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium">
                      <div className="relative inline-block" ref={dropdownRef}>
                        <button
                          onClick={() => toggleDropdown(profile.id)}
                          disabled={isAdding || isUpdating || isDeleting}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          <span className="text-sm">Actions</span>
                          <ChevronDownIcon className="h-4 w-4" />
                        </button>

                        {activeDropdown === profile.id && (
                          <div className={`actions-dropdown absolute right-0 z-[9999] w-36 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800 ${
                            profile.id === profiles[profiles.length - 1]?.id ? 'bottom-full mb-1' : 'top-full mt-1'
                          }`}>
                            <div className="py-1">
                              <button
                                onClick={() => handleEdit(profile)}
                                disabled={isAdding || isUpdating || isDeleting}
                                className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                              >
                                <PencilIcon className="mr-3 h-4 w-4 text-amber-500" />
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedProfile(profile);
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
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredProfiles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No profiles found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search' : 'No job competency profiles have been created yet'}
          </p>
        </div>
      )}

      {/* Add Profile Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm pt-24 pb-8">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 dark:bg-gray-900">
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white">Add New Profile</h2>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="jobId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Job Title
                </label>
                <select
                  id="jobId"
                  name="jobId"
                  value={formData.jobId}
                  onChange={handleFormChange}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">Select a job</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="competencyId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Competency
                </label>
                <select
                  id="competencyId"
                  name="competencyId"
                  value={formData.competencyId}
                  onChange={handleFormChange}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">Select a competency</option>
                  {competencies.map(competency => (
                    <option key={competency.id} value={competency.id}>{competency.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="requiredLevel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Required Proficiency Level
                </label>
                <select
                  id="requiredLevel"
                  name="requiredLevel"
                  value={formData.requiredLevel}
                  onChange={handleFormChange}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                >
                  <option value="0">Select a proficiency level</option>
                  {proficiencyLevels.map(level => (
                    <option key={level.levelNumber} value={level.levelNumber}>{level.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
                    'Add Profile'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm pt-24 pb-8">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 dark:bg-gray-900">
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white">Edit Profile</h2>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="edit_jobId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Job Title
                </label>
                <select
                  id="edit_jobId"
                  name="jobId"
                  value={formData.jobId}
                  onChange={handleFormChange}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">Select a job</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit_competencyId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Competency
                </label>
                <select
                  id="edit_competencyId"
                  name="competencyId"
                  value={formData.competencyId}
                  onChange={handleFormChange}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">Select a competency</option>
                  {competencies.map(competency => (
                    <option key={competency.id} value={competency.id}>{competency.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit_requiredLevel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Required Proficiency Level
                </label>
                <select
                  id="edit_requiredLevel"
                  name="requiredLevel"
                  value={formData.requiredLevel}
                  onChange={handleFormChange}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                >
                  <option value="0">Select a proficiency level</option>
                  {proficiencyLevels.map(level => (
                    <option key={level.levelNumber} value={level.levelNumber}>{level.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                  disabled={isUpdating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <div className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Updating...
                    </>
                  ) : (
                    'Update Profile'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm pt-24 pb-8">
          <div className="w-full max-w-xs rounded-xl bg-white p-5 dark:bg-gray-900">
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white">Delete Profile</h2>
            <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete this job competency profile?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                disabled={isDeleting}
              >
                {isDeleting ? (
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
