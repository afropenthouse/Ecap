import { useEffect, useState } from 'react';
import { getAssessments, getCompetencies, listUsers, type Assessment, type Competency, type UserSummary } from '../../../api/services';

export default function ConsensusAssessment() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getAssessments(), getCompetencies(), listUsers()])
      .then(([assessmentList, competencyList, userList]) => {
        setAssessments((assessmentList || []).filter(item => item.type === 'CONSENSUS'));
        setCompetencies(competencyList || []);
        setUsers(userList || []);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load consensus assessments.'))
      .finally(() => setLoading(false));
  }, []);

  return <main className="p-6">
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Consensus Assessments</h1>
    <p className="mt-1 text-gray-600 dark:text-gray-400">View finalized consensus results across your organisation.</p>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {loading ? <p className="mt-6 text-gray-500">Loading consensus assessments…</p> : assessments.length === 0 ? <p className="mt-6 rounded-lg bg-white p-5 text-gray-600 dark:bg-gray-900 dark:text-gray-300">No consensus assessments have been finalized yet.</p> : <div className="mt-6 space-y-5">
      {assessments.map(assessment => {
        const employee = users.find(item => item.id === assessment.employeeId);
        const displayName = `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || employee?.email || 'Employee';
        const overall = assessment.ratings?.length ? assessment.ratings.reduce((sum, rating) => sum + rating.rating, 0) / assessment.ratings.length : 0;
        return <section key={assessment.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5 dark:border-gray-800"><div><h2 className="font-semibold text-gray-900 dark:text-white">{displayName}</h2><p className="text-sm text-gray-500 dark:text-gray-400">{employee?.email || ''}</p></div><div className="text-right"><p className="text-sm text-gray-500 dark:text-gray-400">Overall consensus</p><p className="text-xl font-bold text-purple-700 dark:text-purple-300">{overall.toFixed(2)}</p></div></header>
          <div className="divide-y divide-gray-200 dark:divide-gray-800">{(assessment.ratings || []).map(rating => <div key={rating.id} className="flex items-center justify-between gap-4 p-4"><span className="text-gray-800 dark:text-gray-200">{competencies.find(item => item.id === rating.competencyId)?.name || 'Competency'}</span><span className="font-semibold text-purple-700 dark:text-purple-300">{rating.rating.toFixed(2)}</span></div>)}</div>
        </section>;
      })}
    </div>}
  </main>;
}
