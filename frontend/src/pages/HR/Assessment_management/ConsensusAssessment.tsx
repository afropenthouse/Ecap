import { useCallback, useEffect, useRef, useState } from 'react';
import { finalizeConsensusAssessment, getAssessments, getCompetencies, listAssessorAssignments, listUsers, type Assessment, type AssessmentRating, type AssessorAssignment, type Competency, type UserSummary } from '../../../api/services';

interface ConsensusRow {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  selfAssessment: Assessment;
  assessorAssessments: Assessment[];
  savedConsensus: Assessment | null;
  previewRatings: { competencyId: string; selfRating: number; assessorRating: number; consensusRating: number; comments: string[] }[];
}

const isComplete = (assessment: Assessment) => assessment.status === 'COMPLETED' || assessment.status === 'REVIEWED';

export default function ConsensusAssessment() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assignments, setAssignments] = useState<AssessorAssignment[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ConsensusRow | null>(null);
  const autoSavedConsensus = useRef(new Set<string>());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [assessmentRows, assignmentRows, userRows, competencyRows] = await Promise.all([
        getAssessments(), listAssessorAssignments(), listUsers(), getCompetencies(),
      ]);
      setAssessments(assessmentRows || []);
      setAssignments(assignmentRows || []);
      setUsers(userRows || []);
      setCompetencies(competencyRows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load consensus assessments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const userById = new Map(users.map(user => [user.id, user]));
  const grouped = new Map<string, { self: Assessment | null; assessors: Assessment[]; consensus: Assessment | null }>();
  for (const assessment of assessments) {
    const group = grouped.get(assessment.employeeId) || { self: null, assessors: [], consensus: null };
    if (assessment.type === 'SELF' && !group.self) group.self = assessment;
    if (assessment.type === 'ASSESSOR') group.assessors.push(assessment);
    if (assessment.type === 'CONSENSUS' && !group.consensus) group.consensus = assessment;
    grouped.set(assessment.employeeId, group);
  }

  const rows: ConsensusRow[] = [];
  for (const [employeeId, group] of grouped) {
    if (!group.self || !isComplete(group.self)) continue;
    const employeeAssignments = assignments.filter(assignment => assignment.employeeId === employeeId);
    if (!employeeAssignments.length) continue;
    const assignedAssessments = employeeAssignments.map(assignment => group.assessors.find(assessment => assessment.assessorId === assignment.assessorId)).filter((assessment): assessment is Assessment => !!assessment);
    if (assignedAssessments.length !== employeeAssignments.length || assignedAssessments.some(assessment => !isComplete(assessment))) continue;

    const competencyIds = [...new Set((group.self.ratings || []).map(rating => rating.competencyId))];
    const previewRatings = competencyIds.map(competencyId => {
      const selfRating = group.self!.ratings?.find(rating => rating.competencyId === competencyId);
      const assessorRatings = assignedAssessments.map(assessment => assessment.ratings?.find(rating => rating.competencyId === competencyId)).filter((rating): rating is AssessmentRating => !!rating);
      const scores = [selfRating?.rating, ...assessorRatings.map(rating => rating.rating)].filter((rating): rating is number => typeof rating === 'number');
      return {
        competencyId,
        selfRating: selfRating?.rating || 0,
        assessorRating: assessorRatings.length ? assessorRatings.reduce((sum, rating) => sum + rating.rating, 0) / assessorRatings.length : 0,
        consensusRating: scores.length ? Number((scores.reduce((sum, rating) => sum + rating, 0) / scores.length).toFixed(2)) : 0,
        comments: [selfRating?.comment, ...assessorRatings.map(rating => rating.comment)].filter((comment): comment is string => !!comment),
      };
    });
    const employee = userById.get(employeeId);
    rows.push({
      employeeId,
      employeeName: `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || employee?.email || 'Employee',
      employeeEmail: employee?.email || '',
      selfAssessment: group.self,
      assessorAssessments: assignedAssessments,
      savedConsensus: group.consensus,
      previewRatings,
    });
  }

  const avg = (ratings: { rating: number }[] = []) => ratings.length ? ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length : 0;

  useEffect(() => {
    if (loading) return;
    const pending = rows.filter(row => {
      if (row.previewRatings.length === 0) return false;
      const latestSourceDate = Math.max(
        Date.parse(row.selfAssessment.completedAt || row.selfAssessment.createdAt),
        ...row.assessorAssessments.map(assessment => Date.parse(assessment.completedAt || assessment.createdAt)),
      );
      const savedDate = row.savedConsensus?.completedAt || row.savedConsensus?.createdAt;
      if (savedDate && Date.parse(savedDate) >= latestSourceDate) return false;
      const sourceKey = [row.employeeId, row.selfAssessment.id, ...row.assessorAssessments.map(assessment => assessment.id).sort()].join(':');
      return !autoSavedConsensus.current.has(sourceKey);
    });
    if (pending.length === 0) return;

    void Promise.all(pending.map(async row => {
      const sourceKey = [row.employeeId, row.selfAssessment.id, ...row.assessorAssessments.map(assessment => assessment.id).sort()].join(':');
      autoSavedConsensus.current.add(sourceKey);
      try {
        const saved = await finalizeConsensusAssessment(row.employeeId);
        setAssessments(current => [...current.filter(item => !(item.type === 'CONSENSUS' && item.employeeId === row.employeeId)), saved]);
      } catch (err) {
        setError(err instanceof Error ? err.message : `Could not save consensus for ${row.employeeName}.`);
      }
    }));
  }, [loading, rows]);

  return <main className="p-6">
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Consensus Assessments</h1>
    <p className="mb-6 mt-1 text-gray-600 dark:text-gray-400">Consensus results are calculated and saved automatically after the employee and all assigned assessors complete their assessments.</p>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {loading ? <p className="text-gray-500">Loading assessments…</p> : rows.length === 0 ? <p className="rounded-lg border border-gray-200 bg-white p-5 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">No employees have completed all assigned assessments yet.</p> : <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800"><thead className="bg-gray-50 dark:bg-gray-800"><tr>
        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th><th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">Self rating</th><th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">Assigned assessors</th><th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">Consensus</th><th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Action</th>
      </tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-800">{rows.map(row => {
        const selfAverage = avg(row.selfAssessment.ratings || []);
        const visibleConsensusAverage = row.previewRatings.length
          ? avg(row.previewRatings.map(rating => ({ rating: rating.consensusRating })))
          : avg(row.savedConsensus?.ratings || []);
        return <tr key={row.employeeId}>
          <td className="px-4 py-4"><p className="font-medium text-gray-900 dark:text-white">{row.employeeName}</p><p className="text-sm text-gray-500">{row.employeeEmail}</p></td>
          <td className="px-4 py-4 text-center">{selfAverage.toFixed(2)}</td>
          <td className="px-4 py-4 text-center">{row.assessorAssessments.length}</td>
          <td className="px-4 py-4 text-center font-semibold text-purple-700 dark:text-purple-300">{row.previewRatings.length ? visibleConsensusAverage.toFixed(2) : '—'}</td>
          <td className="px-4 py-4 text-right"><button onClick={() => setSelected(row)} className="rounded-md border px-3 py-1.5 text-sm">Review</button></td>
        </tr>;
      })}</tbody></table>
    </div>}

    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><section className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-6 dark:bg-gray-900">
      <div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-bold text-gray-900 dark:text-white">Review consensus: {selected.employeeName}</h2><p className="text-sm text-gray-500">{selected.assessorAssessments.length} assigned assessor(s)</p></div><button onClick={() => setSelected(null)} className="text-gray-500">Close</button></div>
      <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800"><thead><tr className="text-left text-xs uppercase text-gray-500"><th className="py-3">Competency</th><th className="py-3 text-center">Employee</th><th className="py-3 text-center">Assessors average</th><th className="py-3 text-center">Consensus average</th><th className="py-3">Comments</th></tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-800">{selected.previewRatings.map(rating => {
        const savedRating = selected.savedConsensus?.ratings?.find(item => item.competencyId === rating.competencyId)?.rating;
        return <tr key={rating.competencyId}><td className="py-3">{competencies.find(item => item.id === rating.competencyId)?.name || 'Competency'}</td><td className="py-3 text-center">{rating.selfRating}</td><td className="py-3 text-center">{rating.assessorRating.toFixed(2)}</td><td className="py-3 text-center font-semibold text-purple-700">{(savedRating ?? rating.consensusRating).toFixed(2)}</td><td className="max-w-sm py-3 text-sm text-gray-500">{rating.comments.join(' · ') || '—'}</td></tr>;
      })}</tbody></table></div>
    </section></div>}
  </main>;
}
