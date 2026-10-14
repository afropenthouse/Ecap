import React, { useState, useEffect } from 'react';
import {
  listAppraisals,
  getAppraisalQuestions,
  getAppraisalResponses,
  updateAppraisalStatus,
  type PerformanceAppraisal,
  type PerformanceAppraisalQuestion,
  type PerformanceAppraisalResponse
} from '../../../api/appraisals';
import {
  ClipboardDocumentCheckIcon,
  UserIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';

const HRAppraisal: React.FC = () => {
  const [appraisals, setAppraisals] = useState<PerformanceAppraisal[]>([]);
  const [questions, setQuestions] = useState<PerformanceAppraisalQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, PerformanceAppraisalResponse[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [selectedAppraisal, setSelectedAppraisal] = useState<PerformanceAppraisal | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [reviewing, setReviewing] = useState(false);
  const [responsesLoading, setResponsesLoading] = useState(false);

  // Load appraisals
  const fetchAppraisals = async () => {
    try {
      setLoading(true);
      const data = await listAppraisals();
      setAppraisals(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching appraisals:', err);
      setError('Failed to load appraisals');
      setLoading(false);
    }
  };

  // Load questions
  const fetchQuestions = async () => {
    try {
      const data = await getAppraisalQuestions();
      setQuestions(data);
    } catch (err) {
      console.error('Error fetching questions:', err);
      setError(err instanceof Error ? err.message : 'Could not load appraisal questions.');
    }
  };

  // Load responses for an appraisal
  const fetchResponses = async (appraisalId: string) => {
    try {
      const data = await getAppraisalResponses(appraisalId);
      setResponses(prev => ({
        ...prev,
        [appraisalId]: data
      }));
    } catch (err) {
      console.error('Error fetching responses:', err);
      setError(err instanceof Error ? err.message : 'Could not load saved appraisal answers.');
    }
  };

  // Filter appraisals (exclude PENDING from HR view)
  const filteredAppraisals = appraisals
    .filter(appraisal => {
    const employeeName = `${appraisal.employee?.firstName || ''} ${appraisal.employee?.lastName || ''}`.toLowerCase();
    const assessorName = appraisal.assessor ? `${appraisal.assessor.firstName || ''} ${appraisal.assessor.lastName || ''}`.toLowerCase() : '';
    const matchesSearch = employeeName.includes(searchTerm.toLowerCase()) ||
                         assessorName.includes(searchTerm.toLowerCase()) ||
                         appraisal.employee?.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || appraisal.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || appraisal.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
    });

  // Handle view appraisal details
  const handleViewAppraisal = async (appraisal: PerformanceAppraisal) => {
    setError(null);
    setResponsesLoading(true);
    setSelectedAppraisal(appraisal);
    setViewMode('detail');
    if (!responses[appraisal.id]) {
      await fetchResponses(appraisal.id);
    }
    if (appraisal.type === 'ASSESSOR') {
      const self = appraisals.find(row => row.type === 'SELF' && row.employeeId === appraisal.employeeId && Date.parse(row.createdAt) <= Date.parse(appraisal.createdAt));
      if (self && !responses[self.id]) await fetchResponses(self.id);
    }
    setResponsesLoading(false);
  };

  // Handle back to list
  const handleBackToList = () => {
    setSelectedAppraisal(null);
    setViewMode('list');
  };

  const calculateAverageRating = (appraisalId: string) => {
    const appraisal = appraisals.find(item => item.id === appraisalId);
    if (appraisal?.averageRating != null) return appraisal.averageRating.toFixed(1);
    const ratings = (responses[appraisalId] || []).map(response => appraisal?.type === 'ASSESSOR' ? response.assessorRating : response.employeeRating).filter((rating): rating is number => rating != null);
    return ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : '-';
  };

  const markReviewed = async () => {
    if (!selectedAppraisal || reviewing) return;
    setReviewing(true); setError(null);
    try {
      const updated = await updateAppraisalStatus(selectedAppraisal.id, 'REVIEWED');
      setSelectedAppraisal(previous => previous ? { ...previous, ...updated } : updated);
      setAppraisals(previous => previous.map(row => row.id === updated.id ? { ...row, ...updated } : row));
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not mark appraisal reviewed.'); }
    finally { setReviewing(false); }
  };

  const selectedSelfAppraisal = selectedAppraisal?.type === 'ASSESSOR'
    ? appraisals.find(row => row.type === 'SELF' && row.employeeId === selectedAppraisal.employeeId && Date.parse(row.createdAt) <= Date.parse(selectedAppraisal.createdAt)) : selectedAppraisal;

  // Load data on component mount
  useEffect(() => {
    fetchAppraisals();
    fetchQuestions();
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          Performance Appraisals Overview
        </h2>
      </div>

      {error && viewMode === 'detail' && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
      {responsesLoading && <p role="status" className="text-sm text-gray-500">Loading saved answers...</p>}
      {viewMode === 'list' ? (
        <>
          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="REVIEWED">Reviewed</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="ALL">All Types</option>
                <option value="SELF">Self Appraisals</option>
                <option value="ASSESSOR">Assessor Appraisals</option>
              </select>

              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <FunnelIcon className="w-4 h-4 mr-2" />
                  {filteredAppraisals.length} of {appraisals.length} appraisals
              </div>
            </div>
          </div>

          {/* Loading/Error states */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
              {error}
            </div>
          ) : (
            /* Appraisal List */
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">All Performance Appraisals</h3>
              </div>
              <div className="p-4">
                {filteredAppraisals.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    <ClipboardDocumentCheckIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>No appraisals found matching your criteria.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Employee</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Avg Rating</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredAppraisals.map((appraisal) => (
                          <tr key={appraisal.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center">
                                  <UserIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                                    {appraisal.employee?.firstName} {appraisal.employee?.lastName}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {appraisal.employee?.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {appraisal.type === 'SELF' ? 'Self Appraisal' : 'Assessor Appraisal'}
                            </td>
                            {/* Assessor column removed in HR view */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                appraisal.status === 'COMPLETED' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                appraisal.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                appraisal.status === 'REVIEWED' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              }`}>
                                {appraisal.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {calculateAverageRating(appraisal.id)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {new Date(appraisal.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => handleViewAppraisal(appraisal)}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                              >
                                <EyeIcon className="w-4 h-4 mr-1" />
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Detail View */
        selectedAppraisal && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBackToList}
                className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                ← Back to list
              </button>
              <div className="text-right">
                {selectedAppraisal.status === 'COMPLETED' && <button type="button" disabled={reviewing || responsesLoading || !!error} onClick={() => void markReviewed()} className="mr-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{reviewing ? 'Saving...' : 'Mark reviewed'}</button>}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  selectedAppraisal.status === 'COMPLETED' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  selectedAppraisal.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                  selectedAppraisal.status === 'REVIEWED' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                }`}>
                  {selectedAppraisal.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-gray-900 dark:text-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Employee Information</h3>
                  <div className="space-y-2">
                    <p><span className="font-medium">Name:</span> {selectedAppraisal.employee?.firstName} {selectedAppraisal.employee?.lastName}</p>
                    <p><span className="font-medium">Email:</span> {selectedAppraisal.employee?.email}</p>
                    <p><span className="font-medium">Type:</span> {selectedAppraisal.type === 'SELF' ? 'Self Appraisal' : 'Assessor Appraisal'}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appraisal Details</h3>
                  <div className="space-y-2">
                    <p><span className="font-medium">Created:</span> {new Date(selectedAppraisal.createdAt).toLocaleDateString()}</p>
                    <p><span className="font-medium">Started:</span> {selectedAppraisal.startedAt ? new Date(selectedAppraisal.startedAt).toLocaleDateString() : 'Not started'}</p>
                    <p><span className="font-medium">Completed:</span> {selectedAppraisal.completedAt ? new Date(selectedAppraisal.completedAt).toLocaleDateString() : 'Not completed'}</p>
                    <p><span className="font-medium">Average Rating:</span> {calculateAverageRating(selectedAppraisal.id)}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Responses</h3>
                <div className="space-y-6">
                  {questions.map((question) => {
                    const response = responses[selectedAppraisal.id]?.find(r => r.questionId === question.id);
                    return (
                      <div key={question.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <h4 className="text-base font-medium text-gray-900 dark:text-white mb-2">
                          {question.order}. {question.title}
                        </h4>

                        <div className="space-y-4 mb-4">
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                            <h5 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">How to Measure:</h5>
                            <p className="text-sm text-blue-700 dark:text-blue-400">{question.howToMeasure}</p>
                          </div>
                          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                            <h5 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">Good Indicator:</h5>
                            <p className="text-sm text-green-700 dark:text-green-400">{question.goodIndicator}</p>
                          </div>
                          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                            <h5 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">Red Flag:</h5>
                            <p className="text-sm text-red-700 dark:text-red-400">{question.redFlag}</p>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                            <h5 className="text-sm font-medium text-gray-800 dark:text-gray-300 mb-2">Rating Criteria:</h5>
                            <p className="text-sm text-gray-700 dark:text-gray-400">{question.ratingCriteria}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Employee Rating</h5>
                            <div className="flex space-x-2">
                              {[1, 2, 3, 4, 5].map((rating) => (
                                <div
                                  key={rating}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                    (response?.employeeRating ?? responses[selectedSelfAppraisal?.id || ""]?.find(item => item.questionId === question.id)?.employeeRating) === rating
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                                  }`}
                                >
                                  {rating}
                                </div>
                              ))}
                            </div>
                          </div>

                          {selectedAppraisal.type === 'ASSESSOR' && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assessor Rating</h5>
                              <div className="flex space-x-2">
                                {[1, 2, 3, 4, 5].map((rating) => (
                                  <div
                                    key={rating}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                      response?.assessorRating === rating
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                                    }`}
                                  >
                                    {rating}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Show numeric ratings only (no comments) */}
                        <div className="mt-4 flex items-center space-x-6">
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee Rating (number)</h5>
                            <p className="text-sm text-gray-900 dark:text-white">{response?.employeeRating ?? responses[selectedSelfAppraisal?.id || ""]?.find(item => item.questionId === question.id)?.employeeRating ?? '—'}</p>
                          </div>

                          {selectedAppraisal.type === 'ASSESSOR' && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assessor Rating (number)</h5>
                              <p className="text-sm text-gray-900 dark:text-white">{response?.assessorRating ?? '—'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default HRAppraisal;

