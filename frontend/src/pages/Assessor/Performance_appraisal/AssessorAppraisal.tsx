import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getAppraisalQuestions, getAppraisalResponses, listAppraisals, saveAppraisalResponse, updateAppraisalStatus, type PerformanceAppraisal, type PerformanceAppraisalQuestion, type PerformanceAppraisalResponse } from '../../../api/appraisals';

const AssessorAppraisal: React.FC = () => {
  const [appraisals, setAppraisals] = useState<PerformanceAppraisal[]>([]);
  const [questions, setQuestions] = useState<PerformanceAppraisalQuestion[]>([]);
  const [responses, setResponses] = useState<PerformanceAppraisalResponse[]>([]);
  const [employeeResponses, setEmployeeResponses] = useState<PerformanceAppraisalResponse[]>([]);
  const [selected, setSelected] = useState<PerformanceAppraisal | null>(null);
  const [index, setIndex] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const saveQueues = useRef(new Map<string, Promise<void>>());

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, bank] = await Promise.all([listAppraisals(), getAppraisalQuestions()]);
      setAppraisals(rows);
      setQuestions(bank);
    } catch (e) {
      console.error(e);
      setError('Could not load performance appraisals. Please retry.');
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const open = async (appraisal: PerformanceAppraisal) => {
    setSelected(appraisal);
    setIndex(0);
    setError('');
    try {
      const assigned = await getAppraisalResponses(appraisal.id);
      setResponses(assigned);
      const self = appraisals.find(row => row.type === 'SELF' && row.employeeId === appraisal.employeeId);
      setEmployeeResponses(self ? await getAppraisalResponses(self.id) : []);
    }
    catch (e) { console.error(e); setError('Could not load saved appraisal answers.'); }
  };
  const active = questions[index];
  const assignedAppraisals = appraisals.filter(row => row.type === 'ASSESSOR');
  const answer = useMemo(() => responses.find(r => r.questionId === active?.id), [responses, active]);
  useEffect(() => { setComment(answer?.assessorComment || ''); }, [answer?.id, active?.id]);
  const done = responses.filter(r => r.assessorRating != null).length;
  const readonly = selected?.status === 'COMPLETED' || selected?.status === 'REVIEWED';

  const start = async () => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const updated = await updateAppraisalStatus(selected.id, 'IN_PROGRESS');
      setSelected(updated); setAppraisals(rows => rows.map(row => row.id === updated.id ? updated : row));
      setSuccess('Assessment started. Your answers save as you go.');
    } catch (e) { console.error(e); setError('Could not start this assessment.'); }
    finally { setBusy(false); }
  };
  const save = async (rating: number, note = comment) => {
    if (!selected || !active || readonly) return;
    const questionId = active.id;
    const optimistic: PerformanceAppraisalResponse = {
      id: responses.find(r => r.questionId === questionId)?.id || `pending-${questionId}`,
      organizationId: selected.organizationId,
      appraisalId: selected.id,
      questionId,
      assessorRating: rating,
      assessorComment: note || null,
    };
    setResponses(rows => rows.some(row => row.questionId === questionId)
      ? rows.map(row => row.questionId === questionId ? { ...row, ...optimistic } : row)
      : [...rows, optimistic]);
    setPendingSaves(count => count + 1);
    setError(''); setSuccess('Saving your answer…');
    const queuedSave = (saveQueues.current.get(questionId) || Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        const saved = await saveAppraisalResponse(selected.id, questionId, rating, note);
        if (saveQueues.current.get(questionId) === queuedSave) {
          setResponses(rows => rows.some(row => row.questionId === saved.questionId)
            ? rows.map(row => row.questionId === saved.questionId ? saved : row)
            : [...rows, saved]);
        }
      });
    saveQueues.current.set(questionId, queuedSave);
    try {
      await queuedSave;
      if (saveQueues.current.get(questionId) === queuedSave) setSuccess('Answer saved');
    } catch (e) {
      console.error(e);
      if (saveQueues.current.get(questionId) === queuedSave) { setSuccess(''); setError('Could not save this answer. Please retry.'); }
    } finally {
      if (saveQueues.current.get(questionId) === queuedSave) saveQueues.current.delete(questionId);
      setPendingSaves(count => Math.max(0, count - 1));
    }
  };
  const submit = async () => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const updated = await updateAppraisalStatus(selected.id, 'COMPLETED');
      setSelected(updated); setAppraisals(rows => rows.map(row => row.id === updated.id ? updated : row));
      setSuccess('Assessor appraisal submitted.');
    } catch (e) { console.error(e); setError('Answer every question before submitting.'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading performance appraisals…</div>;
  return <main className="space-y-6 p-6">
    <header><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Performance Appraisal</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Complete appraisals assigned to you across your organisation.</p></header>
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
    {success && <div role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">{success}</div>}
    {selected ? <section className="rounded-xl bg-white p-5 shadow dark:bg-gray-800">
      <button onClick={() => { setSelected(null); setSuccess(''); }} className="mb-4 text-sm text-blue-600">← All assigned appraisals</button>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selected.employee?.firstName} {selected.employee?.lastName}</h2><p className="text-sm text-gray-500">{selected.employee?.email}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">{selected.status.replace('_', ' ')}</span></div>
      {selected.status === 'PENDING' ? <div className="py-10 text-center"><p className="text-gray-600 dark:text-gray-300">The employee has submitted their self-appraisal. Start your independent assessment when ready.</p><button disabled={busy} onClick={() => void start()} className="mt-4 rounded-lg bg-blue-600 px-5 py-2.5 text-white disabled:opacity-50">Start assessment</button></div> : active ? <div className="mx-auto mt-6 max-w-3xl">
        <div className="mb-3 flex justify-between text-sm text-gray-500"><span>Question {index + 1} of {questions.length}</span><span>{done}/{questions.length} answered</span></div><div className="mb-5 h-2 rounded-full bg-gray-100 dark:bg-gray-700"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${questions.length ? done / questions.length * 100 : 0}%` }} /></div>
        <article className="rounded-xl border border-gray-200 p-6 dark:border-gray-700"><h3 className="text-xl font-semibold text-gray-900 dark:text-white">{active.title}</h3>{active.description && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{active.description}</p>}
          {employeeResponses.find(r => r.questionId === active.id) && <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-700"><strong className="text-gray-800 dark:text-gray-100">Employee self-rating:</strong> <span className="text-gray-700 dark:text-gray-200">{employeeResponses.find(r => r.questionId === active.id)?.employeeRating ?? '—'}/5</span>{employeeResponses.find(r => r.questionId === active.id)?.employeeComment && <p className="mt-1 text-gray-600 dark:text-gray-300">{employeeResponses.find(r => r.questionId === active.id)?.employeeComment}</p>}</div>}
          {active.howToMeasure && <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-200"><strong>How to measure</strong><p className="mt-1">{active.howToMeasure}</p></div>}
          {active.ratingCriteria && <p className="mt-3 text-sm text-gray-600 dark:text-gray-300"><strong>Rating criteria:</strong> {active.ratingCriteria}</p>}{active.goodIndicator && <p className="mt-2 text-sm text-green-700 dark:text-green-300">{active.goodIndicator}</p>}{active.redFlag && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{active.redFlag}</p>}
          <div className="mt-5"><p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Your assessor rating</p><div className="grid grid-cols-5 gap-2">{[1,2,3,4,5].map(n => <button key={n} disabled={readonly || busy} onClick={() => void save(n)} className={`min-h-14 rounded-lg border text-lg font-semibold disabled:opacity-60 ${answer?.assessorRating === n ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-700 hover:border-blue-400 dark:border-gray-600 dark:text-gray-200'}`}>{n}</button>)}</div></div>
          <label className="mt-5 block text-sm font-medium text-gray-700 dark:text-gray-300">Assessor notes <span className="font-normal text-gray-500">(optional)</span><textarea value={comment} maxLength={2000} rows={3} disabled={readonly || busy} onChange={e => setComment(e.target.value)} onBlur={() => { if (answer?.assessorRating != null && !readonly) void save(answer.assessorRating, comment); }} className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></label>
          <div className="mt-6 flex justify-between"><button disabled={index === 0} onClick={() => setIndex(i => Math.max(0, i - 1))} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40 dark:border-gray-600 dark:text-white">Previous</button>{index < questions.length - 1 && <button onClick={() => setIndex(i => i + 1)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Next question</button>}</div>
        </article>
        <nav aria-label="Appraisal questions" className="mt-4 flex flex-wrap gap-2">{questions.map((q, i) => <button key={q.id} aria-label={`Go to question ${i + 1}`} onClick={() => setIndex(i)} className={`h-9 w-9 rounded-full text-xs ${i === index ? 'bg-blue-600 text-white' : responses.some(r => r.questionId === q.id && r.assessorRating != null) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{i + 1}</button>)}</nav>
        {!readonly && <div className="mt-6 text-center"><button disabled={busy || pendingSaves > 0 || done !== questions.length || !questions.length} onClick={() => void submit()} className="rounded-lg bg-green-600 px-6 py-3 font-medium text-white disabled:bg-gray-400">{pendingSaves ? 'Saving answers…' : 'Submit assessor appraisal'}</button>{done !== questions.length && <p className="mt-2 text-xs text-gray-500">Complete all questions to submit.</p>}</div>}
      </div> : <p className="py-10 text-center text-gray-500">No appraisal questions are configured for this organisation.</p>}
    </section> : <section className="rounded-xl bg-white shadow dark:bg-gray-800"><div className="border-b p-5 dark:border-gray-700"><h2 className="font-semibold text-gray-900 dark:text-white">Assigned appraisals ({assignedAppraisals.length})</h2></div>{assignedAppraisals.length ? <div className="divide-y dark:divide-gray-700">{assignedAppraisals.map(a => <button key={a.id} onClick={() => void open(a)} className="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-700"><span><span className="block font-medium text-gray-900 dark:text-white">{a.employee?.firstName} {a.employee?.lastName}</span><span className="text-sm text-gray-500">{a.employee?.email}</span></span><span className="rounded-full bg-gray-100 px-3 py-1 text-xs dark:bg-gray-700 dark:text-gray-200">{a.status.replace('_', ' ')}</span></button>)}</div> : <div className="p-8 text-center text-gray-500">No assigned performance appraisals yet.</div>}</section>}
  </main>;
};

export default AssessorAppraisal;
