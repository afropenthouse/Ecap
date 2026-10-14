import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { generateTalentAI, getTalentAIStatus, type AIMode, type TalentAIResult, type TalentReport } from '../../../api/talent';

type Props = { mode: AIMode; from: string; to: string; employeeIds: string[]; jobId?: string; report: TalentReport; scopeLabel: string };
type ReportStyle = 'executive' | 'detailed' | 'development';
const choices = {
  recommendations: {
    title: 'What should your people do next?', subtitle: 'Ask AI to turn competencies and performance into practical recommendations.', action: 'Generate recommendations',
    placeholder: 'For example: Identify strengths, recommend training for competency gaps, and suggest suitable additional responsibilities.',
    prompts: [['Build development plans', 'Create individual development plans from competency gaps and appraisal results. Include mentoring, suggested timelines and measurable success criteria.'], ['Explore role opportunities', 'Identify suitable additional roles or supervised stretch assignments. Explain the evidence, remaining gaps and what HR should verify.'], ['Find coaching priorities', 'Review the relationship between competency and performance. Suggest coaching priorities without treating missing ratings as poor performance.']],
    empty: 'Recommendations that lead to action', details: ['Training and mentoring tied to real competency gaps', 'Other-role opportunities with supporting evidence', 'Practical next steps for one person or your team'],
  },
  succession: {
    title: 'What other roles could this employee grow into?', subtitle: 'AI uses their assessor-reviewed competencies to suggest possible next roles.', action: 'Suggest job roles',
    placeholder: 'Name specific job titles this employee could explore. Explain why each fits their assessed strengths and what they should develop.',
    prompts: [['Find suitable roles', 'Name one to three specific job titles this employee could explore from their assessor-reviewed competencies. Explain each connection and one development step. Performance appraisal is optional.'], ['Plan role development', 'Identify other roles this employee could develop towards. State the main skill gap and one practical development step for each.'], ['Explore a new direction', 'Suggest other career directions from the employee’s assessor-reviewed strengths, even outside current company job profiles. Explain the evidence and skills to develop.']],
    empty: 'Other roles worth exploring', details: ['Suitable roles supported by assessment evidence', 'Skills to develop for each role', 'A clear next step for HR and the employee'],
  },
  reports: {
    title: 'Turn assessment data into a useful report', subtitle: 'Write an executive summary, an employee review, or a development report.', action: 'Write report',
    placeholder: 'For example: Write a management report covering competencies, performance, training priorities and role opportunities. Clearly explain missing evidence.',
    prompts: [['Write a management summary', 'Write a concise management report covering competency strengths and gaps, assessor performance, development priorities and role opportunities.'], ['Review each employee', 'Write a report for each selected employee, connecting competency assessment to performance appraisal and giving practical development recommendations.'], ['Plan training priorities', 'Write a training-needs report. Group competency gaps into development priorities and propose measurable follow-up actions.']],
    empty: 'A report written around your people', details: ['A readable executive summary and clear findings', 'Individual or organisation-wide development priorities', 'Downloadable reports with assessment references'],
  },
};
const button = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800';

export default function TalentAIAdvice({ mode, from, to, employeeIds, jobId, report, scopeLabel }: Props) {
  const selectedPerson = mode !== 'reports' && employeeIds.length === 1 ? report.employees.find(person => person.id === employeeIds[0]) : undefined;
  const assessorReview = selectedPerson?.role === 'ASSESSOR';
  const config = assessorReview ? {
    ...choices.recommendations,
    title: 'Help this assessor develop their review practice',
    subtitle: 'Turn review activity into practical coaching, calibration and follow-up suggestions.',
    placeholder: 'For example: Suggest a development plan for this assessor covering evidence-based feedback, calibration and manageable review follow-up. Explain where the available review evidence is limited.',
    prompts: [['Strengthen feedback', 'Recommend practical ways to strengthen evidence-based feedback and useful competency notes. Missing optional notes alone are not evidence of poor review quality.'], ['Plan calibration', 'Suggest calibration conversations using differences between self and assessor ratings as discussion points, without treating disagreement as proof of bias or inaccurate judgement.'], ['Plan review follow-up', 'Recommend a manageable review and mentoring plan using current assignments and completed review activity. Do not infer the assessor own employee performance from their reviews.']],
    empty: 'A focused assessor development review',
    details: ['Practical feedback and calibration suggestions', 'Review activity kept separate from personal performance', 'Clear mentoring and follow-up checkpoints'],
  } : mode === 'recommendations' ? { ...choices.recommendations,
    title: 'A practical development plan for one person',
    subtitle: 'Connect this employee’s strengths, competency gaps and performance evidence to clear next steps.',
    empty: 'A recommendation built around this person',
    details: ['Strengths and development needs grounded in assessment evidence', 'Training, mentoring and supervised experience where supported', 'Measurable follow-up actions for HR and the employee'],
  } : choices[mode];
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [result, setResult] = useState<TalentAIResult | null>(null);
  const [brief, setBrief] = useState('');
  const [style, setStyle] = useState<ReportStyle>('executive');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'overview' | 'actions' | 'evidence'>('overview');
  const [elapsed, setElapsed] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [lastRequest, setLastRequest] = useState('');
  const request = useRef(0);
  const output = useRef<HTMLDivElement>(null);
  const scope = JSON.stringify({ mode, from, to, employeeIds, jobId, generatedAt: report.generatedAt });
  const selected = report.employees.filter(e => employeeIds.includes(e.id));

  useEffect(() => {
    let active = true;
    getTalentAIStatus().then(data => { if (active) setConfigured(data.configured); }).catch(() => { if (active) setConfigured(null); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    request.current += 1; setResult(null); setError(''); setLoading(false); setView('overview'); setLastRequest('');
    return () => { request.current += 1; };
  }, [scope]);
  useEffect(() => { setBrief(''); }, [mode]);
  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [loading]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const generate = async () => {
    if (loading || cooldown || !selected.length || (mode !== 'reports' && selected.length !== 1)) return;
    const id = ++request.current;
    const focus = brief.trim() || config.placeholder.replace('For example: ', '');
    setLoading(true); setError('');
    try {
      const data = await generateTalentAI({ mode, from, to, employeeIds, jobId, brief: focus, reportStyle: style });
      if (id === request.current) { setResult(data); setLastRequest(focus); setView(mode === 'succession' ? 'actions' : 'overview'); }
    } catch (e) {
      if (id === request.current) {
        const message = e instanceof Error ? e.message : 'We could not generate your analysis. Please try again.';
        setError(message);
        if (/wait 30 seconds/i.test(message)) setCooldown(30);
      }
    } finally { if (id === request.current) setLoading(false); }
  };
  const name = (id: string | null) => {
    const e = report.employees.find(e => e.id === id);
    return e ? `${e.firstName} ${e.lastName}` : 'Selected staff';
  };
  // Resolve anonymised labels locally; personal names are never sent to the model.
  const readable = (text: string) => {
    if (!result) return text;
    return text.replace(/\b(?:Employee|Assessor)\s+\d+\b/gi, label => {
      const subject = result.subjects.find(s => s.label.toLowerCase() === label.toLowerCase());
      return subject ? name(subject.id) : label;
    });
  };
  const facts = (ids: string[]) => ids.flatMap(id => { const fact = result?.evidence.find(e => e.id === id); return fact ? [fact] : []; });
  const citations = (ids: string[]) => <details className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800"><summary className="cursor-pointer font-medium text-teal-700 dark:text-teal-400">Why this was suggested · {ids.length} evidence {ids.length === 1 ? 'reference' : 'references'}</summary><ul className="mt-3 space-y-2 leading-relaxed">{facts(ids).map(e => <li key={e.id}>{readable(e.fact)}</li>)}</ul></details>;
  const reportLines = () => {
    if (!result) return [];
    const a = result.advice;
    return [readable(a.title), `AI-generated draft / HR review required`, `Scope: ${scopeLabel}`, `Period: ${from} to ${to}`, `Generated: ${new Date(result.generatedAt).toLocaleString()}`, '', 'Executive summary', readable(a.summary),
      ...a.sections.flatMap(s => ['', readable(s.heading), readable(s.body)]),
      '', 'Recommended actions', ...a.findings.flatMap(f => ['', `${readable(f.suggestedRole || f.title)}${f.employeeId ? ` / ${name(f.employeeId)}` : ''}`, readable(f.explanation), ...(f.roleAvailability ? [`Company status: ${f.roleAvailability}; vacancy unverified`] : []), ...f.actions.map(action => `- ${readable(action)}`), ...facts(f.evidenceIds).map(e => `Evidence: ${readable(e.fact)}`)]),
      '', 'Next steps', ...a.nextSteps.map(s => `- ${readable(s)}`), '', 'Review notes', ...a.limitations.map(s => `- ${readable(s)}`), '', 'Assessment references', ...result.evidence.map(e => `${e.id}: ${readable(e.fact)}`)];
  };
  const downloadText = () => {
    const url = URL.createObjectURL(new Blob([reportLines().join('\n')], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `people-${mode}-${from}-${to}.txt`; link.click(); URL.revokeObjectURL(url);
  };
  const downloadPDF = async () => {
    if (!result) return;
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF();
      let y = 24;
      const lines = reportLines();
      lines.forEach((paragraph, i) => {
        pdf.setFont('helvetica', i === 0 ? 'bold' : 'normal'); pdf.setFontSize(i === 0 ? 17 : 10);
        const wrapped: string[] = pdf.splitTextToSize(paragraph.replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"'), 170);
        for (const line of wrapped.length ? wrapped : ['']) {
          if (y > 274) { pdf.addPage(); y = 24; }
          pdf.text(line, 20, y); y += i === 0 ? 8 : 5;
        }
        y += 2;
      });
      pdf.save(`people-${mode}-${from}-${to}.pdf`);
    } catch { setError('Unable to download the PDF. You can download the text report instead.'); }
    finally { setExporting(false); }
  };
  const categoryStyle: Record<string, string> = { training: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300', succession: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300', coaching: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300', assessment: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };

  return <div className="space-y-5">
    {selectedPerson && <section className="rounded-2xl border border-teal-100 bg-white px-6 py-5 dark:border-teal-900 dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-teal-700 dark:text-teal-400">{mode === 'succession' ? 'Succession planning for' : 'Recommendation for'}</p><h2 className="mt-1 text-xl font-semibold">{selectedPerson.firstName} {selectedPerson.lastName}</h2><p className="mt-1 text-sm text-slate-500">{selectedPerson.email}</p></div><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 dark:bg-teal-950 dark:text-teal-300">{mode === 'succession' ? 'Possible next roles' : assessorReview ? 'Assessor development' : 'Employee development'}</span></div>{mode === 'succession' && <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm dark:border-slate-800"><div><p className="text-xs text-slate-500">Assessed competency</p><p className="mt-1 font-semibold">{selectedPerson.competency === null ? 'Not assessed' : `${selectedPerson.competency}%`}</p></div>{selectedPerson.performance !== null && <div><p className="text-xs text-slate-500">Assessor performance</p><p className="mt-1 font-semibold">{selectedPerson.performance === null ? 'Not assessed' : `${selectedPerson.performance}%`}</p></div>}</div>}{assessorReview && selectedPerson.assessorActivity && <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">{[['Current assignments', selectedPerson.assessorActivity.assignedEmployees], ['People reviewed', selectedPerson.assessorActivity.reviewedEmployees], ['Competency reviews', selectedPerson.assessorActivity.competencyReviews], ['Performance reviews', selectedPerson.assessorActivity.performanceReviews]].map(([label, value]) => <div key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div>}{assessorReview && <p className="mt-4 text-xs leading-relaxed text-slate-500">Review activity describes work as an assessor. It is not a rating of this person’s own competency or employee performance.</p>}</section>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white px-6 py-5 dark:border-slate-800 dark:from-teal-950/40 dark:to-slate-900"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-400">Powered by AI</span><span className="text-xs text-slate-500">{selected.length} {selected.length === 1 ? 'person' : 'people'} · {scopeLabel}</span></div><h2 className="text-xl font-semibold tracking-tight">{config.title}</h2><p className="mt-1.5 text-sm text-slate-500">{config.subtitle}</p></div>
      <div className="p-6">
        <div className="mb-4 grid gap-2 sm:grid-cols-3">{config.prompts.map(([title, prompt], i) => <button key={title} onClick={() => { setBrief(prompt); if (mode === 'reports' && i === 1) setStyle('detailed'); }} disabled={loading} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-3 text-left text-xs font-medium text-slate-600 transition hover:border-teal-300 hover:bg-teal-50/50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-teal-950/30">{title}</button>)}</div>
        <label htmlFor="hr-ai-focus" className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-300">Your focus <span className="font-normal text-slate-400">(optional)</span></label>
        <textarea id="hr-ai-focus" value={brief} onChange={e => setBrief(e.target.value)} disabled={loading} maxLength={1500} rows={4} placeholder={config.placeholder} className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/30" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>{mode === 'reports' ? <label className="flex items-center gap-2 text-xs text-slate-500">Format<select value={style} disabled={loading} onChange={e => setStyle(e.target.value as ReportStyle)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"><option value="executive">Executive summary</option><option value="detailed">Detailed staff report</option><option value="development">Development plan</option></select></label> : <span className="text-xs text-slate-400">{assessorReview ? 'Based on review activity and available supporting evidence' : mode === 'succession' ? 'Based on completed assessor or consensus assessments' : 'Based on completed assessments & appraisals'}</span>}</div>
          <button onClick={generate} disabled={loading || cooldown > 0 || configured === false || !selected.length || selected.length > 80 || (mode !== 'reports' && selected.length !== 1)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Generating analysis…' : cooldown ? `Try again in ${cooldown}s` : config.action}</button>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">Runs when you generate. Assessment data is anonymised before analysis.</p>
        {configured === false && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">AI is not connected on this server. Configure the backend OpenAI key and restart the server to begin.</p>}
        {!selected.length && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800">{mode === 'succession' ? 'Choose one employee on the left to begin.' : mode === 'recommendations' ? 'Choose one employee or assessor on the left to begin.' : 'Choose one or more staff on the left to begin.'} {report.employees.length === 0 && <Link to="/employee-details" className="font-medium text-teal-700 underline">Add staff to your organisation</Link>}</p>}
        {selected.length > 80 && <p className="mt-3 text-xs text-amber-700">Select a department or up to 80 staff for this analysis.</p>}
      </div>
    </section>
    {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"><div><p className="font-medium">Your analysis couldn’t be completed</p><p className="mt-1 leading-relaxed">{error}</p>{result && <p className="mt-2 text-xs">Your previous analysis is still available below.</p>}<button onClick={generate} disabled={loading || cooldown > 0} className="mt-3 text-xs font-semibold underline disabled:opacity-50">{cooldown ? `Retry in ${cooldown}s` : 'Try again'}</button></div></div>}
    {loading && <div role="status" aria-live="polite" className="rounded-2xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-3"><div><p className="text-sm font-medium">Reviewing evidence and writing your analysis</p><p className="mt-1 text-xs text-slate-500">{selected.length} staff · {elapsed}s elapsed</p></div></div><div className="mt-6 space-y-3"><div className="h-3 w-4/5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /><div className="h-3 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" /><div className="h-3 w-3/5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /></div></div>}
    {!result && !loading && <section className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/50"><h3 className="font-semibold">{config.empty}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">{mode === 'recommendations' ? 'Choose a person, describe what you want to help them develop, and generate a recommendation.' : 'Choose your people, describe your focus, and generate an analysis.'} Your results will appear here.</p><div className="mx-auto mt-6 max-w-md space-y-3 text-left">{config.details.map(detail => <p key={detail} className="flex items-center gap-2.5 text-xs text-slate-500">{detail}</p>)}</div></section>}
    {result && <section ref={output} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 p-6 dark:border-slate-800"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs font-medium text-teal-700 dark:text-teal-400">Analysis ready <span className="font-normal text-slate-400">· {new Date(result.generatedAt).toLocaleString()}{result.cached ? ' · Saved analysis' : ''}</span></div><div className="flex gap-2"><button className={button} onClick={downloadText}>Text</button><button className={button} disabled={exporting} onClick={downloadPDF}>{exporting ? 'Preparing…' : 'Download PDF'}</button></div></div><h2 className="mt-4 text-xl font-semibold tracking-tight">{readable(result.advice.title)}</h2><p className="mt-2 text-xs text-slate-500">{scopeLabel} · {from} to {to} · HR review required</p><details className="mt-3 text-xs text-slate-400"><summary className="cursor-pointer">Analysis request</summary><p className="mt-2 leading-relaxed">{lastRequest}</p></details></div>
      <div className="flex gap-5 border-b border-slate-100 px-6 dark:border-slate-800" role="tablist" aria-label="Analysis views">{(['overview', 'actions', 'evidence'] as const).map(key => <button role="tab" aria-selected={view === key} key={key} onClick={() => setView(key)} className={`border-b-2 py-3 text-xs font-medium ${view === key ? 'border-teal-600 text-teal-700 dark:text-teal-400' : 'border-transparent text-slate-500'}`}>{key === 'overview' ? mode === 'reports' ? 'Written report' : 'Overview' : key === 'actions' ? `${mode === 'succession' ? 'Suggested roles' : 'Action plan'} (${result.advice.findings.length})` : 'Evidence & review notes'}</button>)}</div>
      <div className="p-6">
        {view === 'overview' && <div className="space-y-6"><div className="rounded-xl bg-teal-50/60 p-5 dark:bg-teal-950/30"><h3 className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">Executive summary</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">{readable(result.advice.summary)}</p></div>{result.advice.sections.map((s, i) => <article key={i} className="border-b border-slate-100 pb-5 last:border-0 dark:border-slate-800"><h3 className="font-semibold">{readable(s.heading)}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-300">{readable(s.body)}</p>{citations(s.evidenceIds)}</article>)}{result.advice.nextSteps.length > 0 && <div><h3 className="font-semibold">Suggested next steps</h3><ol className="mt-3 space-y-3">{result.advice.nextSteps.map((s, i) => <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold dark:bg-slate-800">{i + 1}</span>{readable(s)}</li>)}</ol></div>}<button className={button} onClick={() => setView('actions')}>View the action plan</button></div>}
        {view === 'actions' && <div className="space-y-4">{mode === 'succession' && <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{readable(result.advice.summary)}</p>}{result.advice.findings.length === 0 && <div className="rounded-xl bg-slate-50 p-5 text-sm leading-relaxed text-slate-500 dark:bg-slate-800">No individual actions were supported by the current evidence. Review the written analysis for assessment gaps and organisation-wide next steps.</div>}{result.advice.findings.map((f, i) => <article key={i} className="rounded-xl border border-slate-200 p-5 dark:border-slate-700"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${categoryStyle[f.category] || categoryStyle.assessment}`}>{f.category === 'role_suggestion' ? 'Suggested job role' : f.category === 'succession' ? 'Role match' : f.category}</span><span className="text-xs text-slate-500">{f.employeeId ? name(f.employeeId) : 'Team recommendation'}</span>{f.jobId && <span className="text-xs text-slate-400">· {report.employees.flatMap(person => person.roleMatches).find(r => r.jobId === f.jobId)?.title}</span>}</div><h3 className="mt-3 font-semibold">{readable(f.suggestedRole || f.title)}</h3>{f.roleAvailability && <p className="mt-1 text-xs text-slate-500">{f.roleAvailability} · Vacancy unverified</p>}<p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{readable(f.explanation)}</p><ul className="mt-4 space-y-3">{f.actions.map((action, j) => <li key={j} className="flex gap-3 text-sm leading-relaxed">{readable(action)}</li>)}</ul>{citations(f.evidenceIds)}</article>)}</div>}
        {view === 'evidence' && <div className="space-y-5"><div className="rounded-xl bg-amber-50 p-5 dark:bg-amber-950/40"><h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">What HR should review</h3><ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-relaxed text-amber-800 dark:text-amber-300">{result.advice.limitations.map((s, i) => <li key={i}>{readable(s)}</li>)}</ul></div><div><h3 className="flex items-center gap-2 text-sm font-semibold">Source evidence</h3><p className="mt-2 text-xs text-slate-500">These facts were supplied to the model. Missing data is kept separate from low scores.</p><div className="mt-4 space-y-3">{result.evidence.map(e => <article key={e.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"><p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{e.employeeId ? name(e.employeeId) : 'Review context'}</p><p className="mt-2 text-xs leading-relaxed text-slate-500">{readable(e.fact)}</p></article>)}</div></div></div>}
      </div>
      <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-[11px] leading-relaxed text-slate-400 dark:border-slate-800 dark:bg-slate-950/30">Review the evidence and employee interest before making a role assignment.</div>
    </section>}
  </div>;
}
