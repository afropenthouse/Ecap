import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getTalentReport, type AIMode, type TalentEmployee, type TalentReport, type RoleMatch } from '../../../api/talent';
import { createEmployeeJobAssignment } from '../../../api/services';
import TalentAIAdvice from './TalentAIAdvice';
import SelectionEvidence from './SelectionEvidence';

const today = () => new Date().toISOString().slice(0, 10);
const yearAgo = () => new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
const score = (n: number | null) => n === null ? 'Not assessed' : `${n}%`;
const field = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const modes: Array<{ id: AIMode; title: string; path: string; description: string }> = [
  { id: 'recommendations', title: 'Recommendations', path: '/recommendations', description: 'Turn assessment evidence into useful next steps.' },
  { id: 'succession', title: 'Succession planning', path: '/succession', description: 'Select an employee and let AI suggest other job roles from their assessor assessment.' },
  { id: 'reports', title: 'Report', path: '/competency-performance-reports', description: 'Write clear, evidence-based reports for your people.' },
];

export default function TalentInsights() {
  const location = useLocation();
  const mode: AIMode = location.pathname.includes('reports') ? 'reports' : location.pathname.includes('succession') ? 'succession' : 'recommendations';
  const page = modes.find(m => m.id === mode)!;
  const individualReview = mode !== 'reports';
  const [personRole, setPersonRole] = useState('');
  const initialId = new URLSearchParams(location.search).get('employeeId') ?? '';
  const [report, setReport] = useState<TalentReport | null>(null);
  const [from, setFrom] = useState(yearAgo);
  const [to, setTo] = useState(today);
  const [audience, setAudience] = useState<'all' | 'one' | 'selected'>(initialId || mode === 'succession' ? 'one' : 'all');
  const [employeeId, setEmployeeId] = useState(initialId);
  const [picked, setPicked] = useState<string[]>([]);
  const [department, setDepartment] = useState('');
  const [targetJob, setTargetJob] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [assignment, setAssignment] = useState<{ employee: TalentEmployee; role: RoleMatch } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getTalentReport(from, to, mode === 'recommendations').then(data => { if (active) setReport(data); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to, revision, mode]);
  useEffect(() => { if (initialId) { setEmployeeId(initialId); setAudience('one'); } }, [initialId]);

  const jobs = report?.companyRoles ?? [...new Map((report?.employees ?? []).flatMap(person => person.roleMatches).map(role => [role.jobId, role])).values()];
  const departments = [...new Map(jobs.filter(r => r.departmentId).map(r => [r.departmentId!, r.department])).entries()];
  const available = (report?.employees ?? []).filter(e => (!personRole || mode !== 'recommendations' || (e.role ?? 'EMPLOYEE') === personRole) && (!department || e.roleMatches.some(r => r.current && r.departmentId === department)));
  const shown = available.filter(e => `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(search.toLowerCase()));
  const one = available.find(e => e.id === employeeId) ?? (!employeeId && !individualReview ? available[0] : undefined);
  const staff = individualReview ? (one ? [one] : []) : audience === 'all' ? available : audience === 'one' ? (one ? [one] : []) : available.filter(e => picked.includes(e.id));
  const scopeLabel = (individualReview || audience === 'one') && one ? `${one.firstName} ${one.lastName}` : audience === 'selected' ? `${staff.length} selected staff` : department ? `All staff in ${departments.find(([id]) => id === department)?.[1]}` : individualReview ? 'Choose a person' : 'All staff';
  const allSelected = shown.length > 0 && shown.every(e => picked.includes(e.id));
  const toggleAll = () => setPicked(previous => allSelected ? previous.filter(id => !shown.some(e => e.id === id)) : [...new Set([...previous, ...shown.map(e => e.id)])]);

  const exportEvidence = () => {
    const rows: unknown[][] = one?.role === 'ASSESSOR' ? [['Person', 'Account role', 'Current assignments', 'People reviewed', 'Competency reviews', 'Performance reviews', 'Ratings with notes', 'Total ratings', 'Last review'], [`${one.firstName} ${one.lastName}`, 'Assessor', one.assessorActivity?.assignedEmployees, one.assessorActivity?.reviewedEmployees, one.assessorActivity?.competencyReviews, one.assessorActivity?.performanceReviews, one.assessorActivity?.commentedRatings, one.assessorActivity?.totalRatings, one.assessorActivity?.lastReviewAt]] : [['Employee', 'Current roles', 'Competency %', 'Assessor performance %', 'Self competency %', 'Self performance %', 'Competency date', 'Appraisal date', 'Evidence within 90 days']];
    staff.filter(e => e.role !== 'ASSESSOR').forEach(e => rows.push([`${e.firstName} ${e.lastName}`, e.roleMatches.filter(r => r.current).map(r => r.title).join('; '), e.competency, e.performance, e.selfCompetency, e.selfPerformance, e.competencyDate, e.performanceDate, e.aligned]));
    const cell = (v: unknown) => { const s = String(v ?? ''); return `"${(/^[=+@\-\t\r]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"`; };
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `staff-assessment-evidence-${from}-${to}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  const confirmRole = async () => {
    if (!assignment) return;
    setSaving(true); setError('');
    try {
      await createEmployeeJobAssignment({ employeeId: assignment.employee.id, jobId: assignment.role.jobId });
      setAssignment(null); setNotice('Additional role assigned. Manage responsibilities in Assign Job Roles.'); setRevision(r => r + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to assign this role.'); }
    finally { setSaving(false); }
  };

  return <div className="min-h-screen bg-slate-50/70 p-4 text-slate-900 dark:bg-slate-950/30 dark:text-slate-100 sm:p-6 lg:p-8">
    <div className="mx-auto max-w-[1440px] space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400"> People intelligence</div><h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{page.description}</p></div>
        <button onClick={() => setRevision(r => r + 1)} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Refresh evidence</button>
      </header>
      <nav className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900" aria-label="People intelligence tools">{modes.map(m => <Link key={m.id} to={m.path} aria-current={mode === m.id ? 'page' : undefined} className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-medium transition ${mode === m.id ? 'bg-slate-900 text-white shadow-sm dark:bg-teal-600' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{m.title}</Link>)}</nav>
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={() => setRevision(r => r + 1)} className="font-medium underline">Reload evidence</button></div>}
      {notice && <div role="status" className="rounded-xl bg-teal-50 p-4 text-sm text-teal-800">{notice} <Link className="font-medium underline" to="/employee-job-assignment">Manage assignments</Link></div>}
      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div><h2 className="font-semibold">{mode === 'succession' ? 'Choose an employee' : individualReview ? 'Choose a person' : 'Choose your people'}</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">{mode === 'succession' ? 'Explore what else they could do based on their assessor-rated strengths.' : individualReview ? 'A focused recommendation for one employee or assessor.' : 'One person, a team, or your whole organisation.'}</p></div>
          {!individualReview && <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="Analysis audience">{(['all', 'one', 'selected'] as const).map(key => <button key={key} aria-pressed={audience === key} onClick={() => setAudience(key)} className={`rounded-lg px-2 py-2 text-xs font-medium ${audience === key ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>{key === 'all' ? 'All staff' : key === 'one' ? 'One person' : 'Choose staff'}</button>)}</div>}
          {mode === 'recommendations' && <label className="block text-xs font-medium text-slate-500">Account role<select className={field} value={personRole} onChange={e => { setPersonRole(e.target.value); setEmployeeId(''); setDepartment(''); }}><option value="">Employees and assessors</option><option value="EMPLOYEE">Employees</option><option value="ASSESSOR">Assessors</option></select></label>}
          {!(individualReview && personRole === 'ASSESSOR') && <label className="block text-xs font-medium text-slate-500">Current department<select className={field} value={department} onChange={e => { setDepartment(e.target.value); setEmployeeId(''); }}><option value="">All departments</option>{departments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
          {(individualReview || audience === 'one') && <label className="block text-xs font-medium text-slate-500">{mode === 'recommendations' ? 'Person' : 'Employee'}<select className={field} value={one?.id ?? ''} onChange={e => setEmployeeId(e.target.value)}><option value="">{mode === 'recommendations' ? 'Select an employee or assessor' : 'Choose an employee'}</option>{available.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}{individualReview ? ` / ${e.role === 'ASSESSOR' ? 'Assessor' : 'Employee'}` : ''}</option>)}</select></label>}
          {!individualReview && audience === 'selected' && <div><label className="relative block"><input aria-label="Find staff to select" className={`${field} !mt-0 !pl-9`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Find staff…" /></label><div className="my-3 flex justify-between text-xs"><span className="text-slate-500">{staff.length} selected</span><button onClick={toggleAll} className="font-medium text-teal-700">{allSelected ? 'Deselect visible' : 'Select visible'}</button></div><div className="max-h-64 space-y-1 overflow-y-auto">{shown.map(e => <label key={e.id} className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 ${picked.includes(e.id) ? 'bg-teal-50 dark:bg-teal-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}><input type="checkbox" className="mt-1 accent-teal-600" checked={picked.includes(e.id)} onChange={event => setPicked(previous => event.target.checked ? [...new Set([...previous, e.id])] : previous.filter(id => id !== e.id))} /><span><span className="block text-sm font-medium">{e.firstName} {e.lastName}</span><span className="mt-0.5 block text-xs text-slate-500">{e.roleMatches.filter(r => r.current).map(r => r.title).join(', ') || 'No role assigned'}</span></span></label>)}{!shown.length && <p className="py-3 text-xs text-slate-500">No staff match this search.</p>}</div></div>}
          {mode === 'recommendations' && one?.role !== 'ASSESSOR' && <label className="block text-xs font-medium text-slate-500">Explore another role<select className={field} value={targetJob} onChange={e => setTargetJob(e.target.value)}><option value="">All job roles</option>{jobs.map(r => <option key={r.jobId} value={r.jobId}>{r.title}</option>)}</select></label>}
          <div className="border-t border-slate-100 pt-5 dark:border-slate-800"><h3 className="text-xs font-medium text-slate-500">Assessment period</h3><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">From<input type="date" className={`${field} !px-2 text-xs`} value={from} max={to} onChange={e => setFrom(e.target.value)} /></label><label className="text-xs text-slate-500">To<input type="date" className={`${field} !px-2 text-xs`} value={to} min={from} max={today()} onChange={e => setTo(e.target.value)} /></label></div></div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60"><div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">Your analysis includes</div><p className="mt-2 text-2xl font-semibold">{staff.length} <span className="text-sm font-normal text-slate-500">{staff.length === 1 ? 'person' : 'people'}</span></p><p className="mt-1 text-xs text-slate-500">{scopeLabel}</p><SelectionEvidence people={staff} individual={individualReview} performanceOptional={mode === 'succession'} /></div>
        </aside>
        <main className="min-w-0 space-y-5">
          {loading ? <div role="status" className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500">Gathering staff assessment evidence…</p></div> : report && !error ? <>
            <TalentAIAdvice mode={mode} from={from} to={to} employeeIds={staff.map(e => e.id)} jobId={mode === 'recommendations' && one?.role !== 'ASSESSOR' && targetJob ? targetJob : undefined} report={report} scopeLabel={scopeLabel} />
            <details className="group rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5"><div className="flex items-center gap-3"><div><h2 className="text-sm font-semibold">Assessment evidence</h2><p className="mt-1 text-xs text-slate-500">Inspect the source data behind your AI analysis.</p></div></div></summary><div className="border-t border-slate-100 p-5 dark:border-slate-800"><div className="mb-4 flex justify-end"><button onClick={exportEvidence} disabled={!staff.length} className="text-xs font-medium text-teal-700 disabled:opacity-50">Download evidence CSV</button></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr>{['Person', 'Current role', 'Competency', 'Performance', 'Evidence'].map(h => <th key={h} className="pb-3 pr-5 font-medium">{h}</th>)}</tr></thead><tbody>{staff.map(e => <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800"><td className="py-3 pr-5 font-medium">{e.firstName} {e.lastName}</td><td className="pr-5">{e.roleMatches.filter(r => r.current).map(r => r.title).join(', ') || (e.role === 'ASSESSOR' ? 'Assessor' : 'Unassigned')}</td><td className="pr-5">{e.role === 'ASSESSOR' ? 'Not applicable' : score(e.competency)}</td><td className="pr-5">{e.role === 'ASSESSOR' ? 'Review activity' : score(e.performance)}</td><td className="text-slate-500">{e.role === 'ASSESSOR' ? `${e.assessorActivity?.competencyReviews ?? 0} competency reviews, ${e.assessorActivity?.performanceReviews ?? 0} appraisals` : !e.aligned ? 'Incomplete / different periods' : !e.fresh ? 'Needs updating' : 'Aligned'}</td></tr>)}</tbody></table></div>{staff.filter(e => e.role !== 'ASSESSOR').map(e => <details key={e.id} className="mt-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"><summary className="cursor-pointer text-sm font-medium">{e.firstName} {e.lastName}: role requirements & readiness</summary><div className="mt-3 space-y-3 text-xs">{e.roleMatches.filter(r => !targetJob || mode === 'reports' || r.current || r.jobId === targetJob).map(r => <div key={r.jobId} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="font-medium">{r.title} {r.current ? '· Current role' : ''}</p><p className="mt-1 text-slate-500">Match {score(r.fit)} · Coverage {r.coverage}% · {r.readiness}</p><ul className="mt-2 space-y-1">{r.gaps.map(g => <li key={g.competencyId}>{g.competency}: {g.currentLevel ?? 'Not assessed'} / required {g.requiredLevel}</li>)}</ul>{!r.current && r.readiness === 'Ready for HR review' && <button onClick={() => setAssignment({ employee: e, role: r })} className="mt-3 font-medium text-teal-700">Review & assign additional role</button>}</div>)}</div></details>)}<p className="mt-4 text-xs leading-relaxed text-slate-500">Competency uses completed assessor or consensus ratings. Performance uses completed assessor appraisals. Role readiness requires full competency coverage and recent, aligned evidence; HR verifies experience, interest and role context before assigning responsibilities.</p></div></details>
          </> : !loading && !error && <p className="rounded-xl bg-white p-6 text-sm text-slate-500">No assessment data available.</p>}
        </main>
      </div>
    </div>
    {assignment && <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="role-review-title" className="w-full max-w-lg rounded-2xl bg-white p-6 dark:bg-slate-900"><div className="flex items-center justify-between"><h2 id="role-review-title" className="text-lg font-semibold">Review additional role</h2><button aria-label="Close role review" disabled={saving} onClick={() => setAssignment(null)}>Close</button></div><p className="my-5 text-sm leading-relaxed text-slate-500">Assign {assignment.role.title} to {assignment.employee.firstName} {assignment.employee.lastName}? Confirm experience, employee interest, workload and role requirements. This adds a role alongside existing assignments.</p><div className="flex justify-end gap-3"><button disabled={saving} onClick={() => setAssignment(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm">Cancel</button><button disabled={saving} onClick={confirmRole} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Assigning…' : 'Confirm assignment'}</button></div></div></div>}
  </div>;
}
