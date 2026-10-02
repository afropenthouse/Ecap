import React, { useState, useEffect } from 'react';
import {
  listAppraisals,
  getAppraisalQuestions,
  createSelfAppraisal,
  updateAppraisalStatus,
  saveAppraisalResponse,
  getAppraisalResponses,
  type PerformanceAppraisal,
  type PerformanceAppraisalQuestion,
  type PerformanceAppraisalResponse
} from '../../../api/appraisals';
import {
  ClipboardDocumentCheckIcon,
  PlusCircleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { useModal } from '../../../hooks/useModal';
import { Modal } from '../../../components/ui/modal';

const EmployeeAppraisal: React.FC = () => {
  const [appraisals, setAppraisals] = useState<PerformanceAppraisal[]>([]);
  const [questions, setQuestions] = useState<PerformanceAppraisalQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [responses, setResponses] = useState<PerformanceAppraisalResponse[]>([]);
  const [currentAppraisal, setCurrentAppraisal] = useState<PerformanceAppraisal | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [commentDraft, setCommentDraft] = useState('');
  const { isOpen, openModal, closeModal } = useModal();

  const fetchQuestionList = async () => {
    setQuestionsLoading(true);
    setQuestionsError(null);
    try {
      setQuestions(await getAppraisalQuestions());
    } catch (err) {
      console.error('Error fetching appraisal questions:', err);
      setQuestionsError('Questions could not be loaded. Please try again.');
    } finally {
      setQuestionsLoading(false);
    }
  };

  // Load the appraisal list independently so question-bank latency never
  // holds the user's existing appraisal list behind a full-page spinner.
  const fetchPageData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listAppraisals();
      setAppraisals(data.filter(a => a.type === 'SELF'));
      const active = data.find(a => a.type === 'SELF' && a.status === 'IN_PROGRESS')
        || data.find(a => a.type === 'SELF' && a.status === 'PENDING');
      setCurrentAppraisal(active || null);
      if (active?.status === 'IN_PROGRESS') {
        getAppraisalResponses(active.id)
          .then(setResponses)
          .catch(err => {
            console.error('Error fetching appraisal responses:', err);
            setError('Failed to load saved answers. Please retry.');
          });
      }
    } catch (err) {
      console.error('Error fetching appraisal page data:', err);
      setError('Failed to load your appraisals. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  // Load responses for current appraisal
  const fetchResponses = async (appraisalId: string) => {
    try {
      const data = await getAppraisalResponses(appraisalId);
      setResponses(data);
    } catch (err) {
      console.error('Error fetching responses:', err);
      setError('Failed to load responses');
    }
  };

  // Create new appraisal
  const handleCreateAppraisal = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const created = await createSelfAppraisal();
      setAppraisals([created, ...appraisals]);
      setCurrentAppraisal(created);
      setSuccess('New self-appraisal created');
      setSubmitting(false);
    } catch (err) {
      console.error('Error creating appraisal:', err);
      setError('Failed to create appraisal');
      setSubmitting(false);
    }
  };

  // Start appraisal
  const handleStartAppraisal = async (appraisal: PerformanceAppraisal) => {
    try {
      setSubmitting(true);
      setError(null);
      const updated = await updateAppraisalStatus(appraisal.id, 'IN_PROGRESS');
      setAppraisals(appraisals.map(a => a.id === updated.id ? updated : a));
      setCurrentAppraisal(updated);
      await fetchResponses(updated.id);
      setSuccess('Appraisal started');
      setSubmitting(false);
    } catch (err) {
      console.error('Error starting appraisal:', err);
      setError('Failed to start appraisal');
      setSubmitting(false);
    }
  };

  // Complete appraisal
  const handleCompleteAppraisal = async () => {
    if (!currentAppraisal) return;

    try {
      setSubmitting(true);
      setError(null);
      const updated = await updateAppraisalStatus(currentAppraisal.id, 'COMPLETED');
      setAppraisals(appraisals.map(a => a.id === updated.id ? updated : a));
      setCurrentAppraisal(updated);
      setSuccess('Appraisal completed successfully');
      setSubmitting(false);

      // Show success modal
      openModal();
    } catch (err) {
      console.error('Error completing appraisal:', err);
      setError('Failed to complete appraisal');
      setSubmitting(false);
    }
  };

  // Save response
  const handleSaveResponse = async (questionId: string, rating: number, comment: string) => {
    if (!currentAppraisal) return;
    const previousResponses = responses;
    const previous = previousResponses.find(r => r.questionId === questionId);
    const optimistic: PerformanceAppraisalResponse = {
      id: previous?.id || `pending-${questionId}`,
      organizationId: currentAppraisal.organizationId,
      appraisalId: currentAppraisal.id,
      questionId,
      employeeRating: rating,
      employeeComment: comment || null,
    };
    // Show the selected rating immediately; persist it in the background.
    setResponses(previous ? previousResponses.map(r => r.questionId === questionId ? optimistic : r) : [...previousResponses, optimistic]);
    try {
      setSubmitting(true);
      setSuccess('Saving your answer…');
      const saved = await saveAppraisalResponse(currentAppraisal.id, questionId, rating, comment);
      
      // Update responses state
      setResponses(prev => {
        const existing = prev.find(r => r.questionId === questionId);
        if (existing) {
          return prev.map(r => r.questionId === questionId ? saved : r);
        } else {
          return [...prev, saved];
        }
      });
      
      setSubmitting(false);
    } catch (err) {
      console.error('Error saving response:', err);
      setResponses(previousResponses);
      setSuccess(null);
      setError('Failed to save response');
      setSubmitting(false);
    }
  };

  // Get response for a question
  const getResponse = (questionId: string) => {
    return responses.find(r => r.questionId === questionId);
  };

  // Calculate completion percentage
  const calculateCompletion = () => {
    if (!questions.length) return 0;
    const answeredQuestions = responses.filter(r => r.employeeRating !== null && r.employeeRating !== undefined);
    return Math.round((answeredQuestions.length / questions.length) * 100);
  };

  const activeQuestion = questions[activeQuestionIndex];
  const isReadOnly = currentAppraisal?.status === 'COMPLETED' || currentAppraisal?.status === 'REVIEWED';
  const answeredCount = responses.filter(r => r.employeeRating !== null && r.employeeRating !== undefined).length;
  useEffect(() => {
    setCommentDraft(activeQuestion ? (getResponse(activeQuestion.id)?.employeeComment || '') : '');
  }, [activeQuestionIndex, responses, currentAppraisal?.id]);

  // Load data on component mount
  useEffect(() => {
    void fetchPageData();
    void fetchQuestionList();
  }, []);

  return (
    <>
      <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          Performance Appraisal
        </h2>
        <button
          onClick={handleCreateAppraisal}
          disabled={submitting || appraisals.some(a => a.status === 'PENDING' || a.status === 'IN_PROGRESS')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <PlusCircleIcon className="w-5 h-5" />
          New Self-Appraisal
        </button>
      </div>

      {/* Error and success messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-center">
          <ExclamationCircleIcon className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-4 rounded-lg flex items-center">
          <CheckCircleIcon className="w-5 h-5 mr-2" />
          {success}
        </div>
      )}

      {/* Loading indicator */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Appraisal List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Your Appraisals</h3>
            </div>
            <div className="p-4">
              {appraisals.length === 0 ? (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                  <ClipboardDocumentCheckIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No appraisals found. Create a new self-appraisal to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Completed</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {appraisals.map((appraisal) => (
                        <tr key={appraisal.id} className={currentAppraisal?.id === appraisal.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {appraisal.type === 'SELF' ? 'Self Appraisal' : 'Assessor Appraisal'}
                          </td>
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {appraisal.completedAt ? new Date(appraisal.completedAt).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {appraisal.status === 'PENDING' && (
                              <button
                                onClick={() => handleStartAppraisal(appraisal)}
                                disabled={submitting}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4"
                              >
                                Start
                              </button>
                            )}
                            {appraisal.status === 'IN_PROGRESS' && (
                              <button
                                onClick={() => setCurrentAppraisal(appraisal)}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4"
                              >
                                Continue
                              </button>
                            )}
                            {(appraisal.status === 'COMPLETED' || appraisal.status === 'REVIEWED') && (
                              <button
                                onClick={() => {
                                  setCurrentAppraisal(appraisal);
                                  fetchResponses(appraisal.id);
                                }}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4"
                              >
                                View
                              </button>
                            )}
                          </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {!currentAppraisal && (
              <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mb-6">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                    Assessment Questions ({questions.length})
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    These questions appear in your appraisal. Create a self-appraisal above to rate and submit your answers.
                  </p>
                </div>
                {questionsLoading ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">Loading questions…</div>
                ) : questionsError ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    <p>{questionsError}</p>
                    <button type="button" onClick={() => void fetchQuestionList()} className="mt-3 text-blue-600 hover:underline dark:text-blue-400">
                      Retry
                    </button>
                  </div>
                ) : questions.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    <p>No questions are available yet.</p>
                    <button type="button" onClick={() => void fetchQuestionList()} className="mt-3 text-blue-600 hover:underline dark:text-blue-400">
                      Reload questions
                    </button>
                  </div>
                ) : (
                  <ol className="divide-y divide-gray-200 dark:divide-gray-700">
                    {questions.map(question => (
                      <li key={question.id} className="p-5">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{question.order}. {question.title}</h4>
                        {question.description && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{question.description}</p>}
                        {question.howToMeasure && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300"><strong>How to measure:</strong> {question.howToMeasure}</p>}
                        {question.ratingCriteria && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300"><strong>Rating criteria:</strong> {question.ratingCriteria}</p>}
                        {question.goodIndicator && <p className="mt-2 text-sm text-green-700 dark:text-green-300">{question.goodIndicator}</p>}
                        {question.redFlag && <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{question.redFlag}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}

            {/* Current Appraisal Form */}
            {currentAppraisal && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                    {currentAppraisal && (currentAppraisal.status === 'COMPLETED' || currentAppraisal.status === 'REVIEWED')
                      ? 'View Appraisal'
                      : 'Complete Your Self-Appraisal'}
                  </h3>
                </div>

                <div className="p-4">
                  {questionsLoading ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                      <ArrowPathIcon className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-spin" />
                      <p>Loading questions...</p>
                    </div>
                  ) : questionsError ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                      <p>{questionsError}</p>
                      <button type="button" onClick={() => void fetchQuestionList()} className="mt-3 text-blue-600 hover:underline dark:text-blue-400">
                        Retry
                      </button>
                    </div>
                  ) : questions.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400">No appraisal questions are configured. Contact HR.</div>
                  ) : (
                    <div className="space-y-8">
                      {currentAppraisal.status === 'PENDING' ? (
                        <div className="text-center py-8">
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Ready when you are</h4>
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Start your appraisal to save your answers as you go.</p>
                          <button onClick={() => handleStartAppraisal(currentAppraisal)} disabled={submitting} className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50">Start appraisal</button>
                        </div>
                      ) : activeQuestion ? (() => {
                        const question = activeQuestion;
                        const response = getResponse(question.id);
                        return <div className="mx-auto max-w-3xl">
                          <div className="mb-5 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                            <span>Question {activeQuestionIndex + 1} of {questions.length}</span>
                            <span>{answeredCount} answered · {calculateCompletion()}% complete</span>
                          </div>
                          <div className="mb-5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"><div className="h-full bg-blue-600 transition-all" style={{ width: `${calculateCompletion()}%` }} /></div>
                          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                            <h4 className="text-xl font-semibold text-gray-900 dark:text-white">{question.title}</h4>

                            <div className="space-y-4 mb-6">
                              {question.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-300">{question.description}</p>
                              )}
                              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                <h5 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">How to Measure:</h5>
                                <p className="text-sm text-blue-700 dark:text-blue-400">{question.howToMeasure}</p>
                              </div>
                              {question.ratingCriteria && <p className="text-sm text-gray-600 dark:text-gray-300"><strong>Rating criteria:</strong> {question.ratingCriteria}</p>}
                              {question.goodIndicator && <p className="text-sm text-green-700 dark:text-green-300">{question.goodIndicator}</p>}
                              {question.redFlag && <p className="text-sm text-amber-700 dark:text-amber-300">{question.redFlag}</p>}
                            </div>

                            <div className="mb-6">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Your Rating (1-5)
                              </label>
                              <div className="grid grid-cols-5 gap-3">
                                {[1, 2, 3, 4, 5].map((rating) => (
                                  <button
                                    key={rating}
                                    type="button"
                                    disabled={isReadOnly || submitting}
                                    onClick={() => { if (!isReadOnly && !submitting) void handleSaveResponse(question.id, rating, commentDraft); }}
                                    className={`min-h-16 rounded-lg flex flex-col items-center justify-center text-sm font-semibold transition-all ${
                                      response?.employeeRating === rating
                                        ? 'bg-blue-600 text-white shadow-lg transform scale-110'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:shadow-md'
                                    } ${isReadOnly ? 'cursor-not-allowed opacity-70' : 'hover:scale-105'}`}
                                  >
                                    <>{rating}<span className="text-[10px] font-normal">{['Needs support','Developing','Effective','Strong','Exceptional'][rating - 1]}</span></>
                                  </button>
                                ))}
                              </div>
                            </div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Your reflection <span className="font-normal text-gray-500">(optional)</span>
                              <textarea value={commentDraft} onChange={e => setCommentDraft(e.target.value)} onBlur={() => { if (response?.employeeRating && !isReadOnly) void handleSaveResponse(question.id, response.employeeRating, commentDraft); }} disabled={isReadOnly || submitting} maxLength={2000} rows={3} placeholder="Add an example or context for your rating…" className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:opacity-70" />
                            </label>
                            <div className="mt-6 flex justify-between">
                              <button type="button" onClick={() => setActiveQuestionIndex(i => Math.max(0, i - 1))} disabled={activeQuestionIndex === 0} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40 dark:border-gray-600 dark:text-white">Previous</button>
                              {activeQuestionIndex < questions.length - 1 ? <button type="button" onClick={() => setActiveQuestionIndex(i => i + 1)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">Next question</button> : null}
                            </div>
                          </div>
                          <nav aria-label="Appraisal questions" className="mt-4 flex flex-wrap gap-2">{questions.map((q, index) => <button key={q.id} type="button" aria-label={`Go to question ${index + 1}`} onClick={() => setActiveQuestionIndex(index)} className={`h-9 w-9 rounded-full text-xs font-medium ${index === activeQuestionIndex ? 'bg-blue-600 text-white' : getResponse(q.id)?.employeeRating ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{index + 1}</button>)}</nav>
                          {!isReadOnly && <div className="mt-6 text-center"><button onClick={handleCompleteAppraisal} disabled={submitting || calculateCompletion() < 100} className="rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"><CheckCircleIcon className="mr-2 inline h-5 w-5" />Submit appraisal</button>{calculateCompletion() < 100 && <p className="mt-2 text-xs text-gray-500">Answer all {questions.length} questions to submit.</p>}</div>}
                        </div>;
                      })() : null}

                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Success Modal */}
      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-md">
        <div className="p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
              <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Performance Appraisal Submitted Successfully!
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Your performance appraisal has been submitted successfully. Your assessor and HR team will now be able to review your responses.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              You can view your completed appraisal in the appraisals list above.
            </p>
            <button
              onClick={closeModal}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Continue
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default EmployeeAppraisal;
