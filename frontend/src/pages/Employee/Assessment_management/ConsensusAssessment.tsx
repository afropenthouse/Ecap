import { useEffect, useState } from 'react';
import { getAssessments, getCompetencies, type Assessment, type Competency } from '../../../api/services';
import { useAuth } from '../../../context/AuthContext';

export default function ConsensusAssessment() {
  const { user } = useAuth();
  const [consensus, setConsensus] = useState<Assessment | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    Promise.all([getAssessments(), getCompetencies()])
      .then(([assessments, competencyList]) => {
        setConsensus((assessments || []).find(item => item.type === 'CONSENSUS' && item.employeeId === user.id) || null);
        setCompetencies(competencyList || []);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load your consensus assessment.'))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="p-6 text-gray-600 dark:text-gray-300">Loading consensus assessment…</div>;
  return <main className="p-6">
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Consensus Assessment</h1>
    <p className="mt-1 text-gray-600 dark:text-gray-400">Your finalized results combine your self-assessment with ratings from your assigned assessors.</p>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {!consensus ? <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
      Your consensus assessment will appear here after you complete your self-assessment, your assigned assessors finish their reviews, and HR finalizes the results.
    </div> : <section className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-200 p-5 dark:border-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">Finalized {consensus.completedAt ? new Date(consensus.completedAt).toLocaleDateString() : ''}</p>
        <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">Overall rating: {consensus.ratings?.length ? (consensus.ratings.reduce((sum, rating) => sum + rating.rating, 0) / consensus.ratings.length).toFixed(2) : 'N/A'}</p>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-800">
        {(consensus.ratings || []).map(rating => <article key={rating.id} className="flex items-start justify-between gap-4 p-5">
          <div><h2 className="font-medium text-gray-900 dark:text-white">{competencies.find(item => item.id === rating.competencyId)?.name || 'Competency'}</h2><p className="text-sm text-gray-500 dark:text-gray-400">{rating.comment || 'Consensus rating'}</p></div>
          <span className="whitespace-nowrap font-semibold text-purple-700 dark:text-purple-300">{rating.rating.toFixed(2)}</span>
        </article>)}
      </div>
    </section>}
  </main>;
}
