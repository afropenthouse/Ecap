import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChatBubbleLeftRightIcon, XMarkIcon, ArrowUpIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { askHelp, getHelpKnowledge, type HelpAnswer, type HelpArticle, type HelpKnowledge } from '../../api/help';

type Message = { id: number; role: 'user' | 'assistant'; content: string; response?: HelpAnswer };
const inputStyle = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

export default function HelpAssistant() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'guides'>('chat');
  const [knowledge, setKnowledge] = useState<HelpKnowledge | null>(null);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [knowledgeError, setKnowledgeError] = useState('');
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [article, setArticle] = useState<HelpArticle | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const questionInput = useRef<HTMLTextAreaElement>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const request = useRef(0);
  const busy = useRef(false);
  const identity = `${user?.id || ''}:${user?.roles.join(',') || ''}`;
  useEffect(() => {
    request.current += 1; busy.current = false;
    setOpen(false); setKnowledge(null); setMessages([]); setArticle(null); setQuestion(''); setError(''); setKnowledgeError(''); setSending(false); setSearch(''); setView('chat');
    return () => { request.current += 1; busy.current = false; };
  }, [identity]);
  useEffect(() => {
    if (!open || knowledge) return;
    let active = true; setLoadingKnowledge(true); setKnowledgeError('');
    getHelpKnowledge().then(result => { if (active) setKnowledge(result); }).catch(err => { if (active) setKnowledgeError(err instanceof Error ? err.message : 'Could not load help guides.'); }).finally(() => { if (active) setLoadingKnowledge(false); });
    return () => { active = false; };
  }, [open, identity, knowledge, revision]);
  useEffect(() => { if (open && view === 'chat') questionInput.current?.focus(); }, [open, view]);
  useEffect(() => { if (open && view === 'chat') messagesEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [messages, sending, open, view]);
  const close = () => { setOpen(false); launcher.current?.focus(); };
  const send = async (value = question) => {
    const content = value.trim();
    if (!content || content.length > 2000 || busy.current) return;
    busy.current = true; setSending(true); setError(''); setView('chat');
    const id = ++request.current;
    const history = messages.slice(-8).map(message => ({ role: message.role, content: message.content.slice(0, 4000) }));
    setMessages(previous => [...previous, { id: ++sequence.current, role: 'user', content }]); setQuestion('');
    try {
      const response = await askHelp(content, location.pathname, history);
      if (id === request.current) setMessages(previous => [...previous, { id: ++sequence.current, role: 'assistant', content: response.answer, response }]);
    } catch (err) {
      if (id === request.current) { setError(err instanceof Error ? err.message : 'Could not get an answer. Please retry.'); setQuestion(content); }
    } finally { if (id === request.current) { busy.current = false; setSending(false); } }
  };
  const showGuide = (id: string) => { const found = knowledge?.articles.find(item => item.id === id); if (found) { setArticle(found); setView('guides'); } };
  const role = user?.roles[0] || 'employee';
  const starters = role === 'hr' ? ['How do I set up the workspace?', 'How do I assign an assessor?', 'How does Succession Planning work?'] : role === 'assessor' ? ['How do I review an employee?', 'Why can’t I see an assigned employee?', 'Is a performance appraisal different from a competency review?'] : ['How do I complete my self-assessment?', 'What does Individual Gap show?', 'How do I update my profile?'];
  const filteredArticles = (knowledge?.articles || []).filter(item => `${item.title} ${item.summary} ${item.keywords.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  if (!user) return null;
  return <>
    <button ref={launcher} onClick={() => setOpen(previous => !previous)} aria-label={open ? 'Close HRM AI' : 'Open HRM AI'} aria-expanded={open} aria-controls="hrm-help-panel" className="fixed bottom-5 right-5 z-[9990] inline-flex items-center gap-2 rounded-full bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-400/40">
      <ChatBubbleLeftRightIcon className="h-5 w-5" aria-hidden="true" /><span>HRM AI</span>
    </button>
    {open && <section id="hrm-help-panel" role="dialog" aria-label="HRM Office help assistant" aria-modal="false" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }} className="fixed bottom-20 right-3 z-[9990] flex h-[min(680px,calc(100dvh-110px))] w-[min(440px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:right-5">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-teal-50/60 px-5 py-4 dark:border-slate-800 dark:bg-teal-950/30"><div><h2 className="text-base font-semibold">Your HRM Office guide</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Ask a question. Find your next step.</p></div><button onClick={close} aria-label="Close help panel" className="rounded-lg p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-800"><XMarkIcon className="h-5 w-5" /></button></header>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 dark:border-slate-800"><div className="flex gap-4" role="tablist" aria-label="Help views">{(['chat', 'guides'] as const).map(tab => <button key={tab} role="tab" aria-selected={view === tab} onClick={() => { setView(tab); if (tab === 'guides') setArticle(null); }} className={`border-b-2 py-3 text-xs font-semibold ${view === tab ? 'border-teal-700 text-teal-700 dark:text-teal-400' : 'border-transparent text-slate-500'}`}>{tab === 'chat' ? 'Ask AI' : 'Help guides'}</button>)}</div>{view === 'chat' && messages.length > 0 && <button disabled={sending} onClick={() => { setMessages([]); setError(''); setQuestion(''); }} className="text-xs text-slate-500 disabled:opacity-50">New chat</button>}</div>
      {knowledgeError && <div role="alert" className="m-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">{knowledgeError}<button onClick={() => setRevision(value => value + 1)} className="ml-2 font-semibold underline">Retry guides</button></div>}
      {view === 'chat' ? <>
        <div className="min-h-0 flex-1 overflow-y-auto p-4" role="log" aria-label="Help conversation" aria-live="polite" aria-relevant="additions">
          {messages.length === 0 && <div className="space-y-4"><div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300"><p className="font-medium text-slate-800 dark:text-slate-100">Hi! I can help you learn HRM Office.</p><p className="mt-2">Ask about assessments, job profiles, account settings or the page you’re on. I’ll explain the steps available to your account.</p></div><p className="text-xs font-semibold text-slate-500">A few places to start</p><div className="space-y-2">{starters.map(prompt => <button key={prompt} onClick={() => void send(prompt)} disabled={sending} className="w-full rounded-xl border border-slate-200 p-3 text-left text-xs leading-relaxed text-slate-600 hover:border-teal-400 hover:bg-teal-50/50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-teal-950/30">{prompt}</button>)}</div>{knowledge?.configured === false && <p className="text-xs text-slate-500">AI is not connected yet. You can ask for relevant guide instructions or browse Help guides.</p>}</div>}
          <div className="space-y-4">{messages.map(message => <article key={message.id} className={message.role === 'user' ? 'ml-8 rounded-2xl rounded-br-sm bg-teal-700 px-4 py-3 text-sm leading-relaxed text-white' : 'rounded-2xl rounded-bl-sm border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200'}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide opacity-70">{message.role === 'user' ? 'You' : message.response?.mode === 'guide' ? 'Help guide' : 'HRM Office assistant'}</p>
            <div className="space-y-3">{message.content.split(/\n\s*\n/).map((paragraph, index) => <p key={index} className="whitespace-pre-wrap break-words">{paragraph}</p>)}</div>
            {message.response && <>{message.response.steps.length > 0 && <ol className="mt-4 list-decimal space-y-2 pl-5">{message.response.steps.map((step, index) => <li key={index} className="break-words">{step}</li>)}</ol>}{message.response.sources.length > 0 && <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Based on these guides</p><div className="mt-2 flex flex-wrap gap-2">{message.response.sources.map(source => <button key={source.id} onClick={() => showGuide(source.id)} className="rounded-lg border border-teal-100 bg-white px-2 py-1.5 text-left text-xs text-teal-800 dark:border-slate-700 dark:bg-slate-900 dark:text-teal-300">{source.title}</button>)}</div></div>}{message.response.followUps.length > 0 && <div className="mt-3 space-y-1.5">{message.response.followUps.map(followUp => <button key={followUp} onClick={() => void send(followUp)} disabled={sending} className="block text-left text-xs font-medium text-teal-700 hover:underline disabled:opacity-50 dark:text-teal-400">{followUp}</button>)}</div>}</>}
          </article>)}</div>
          {sending && <p role="status" className="mt-4 text-xs text-slate-500">Checking the help guides…</p>}
          {error && <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">{error}<p className="mt-1">Your question is back in the box below. You can retry or browse Help guides.</p></div>}
          <div ref={messagesEnd} />
        </div>
        <form className="shrink-0 border-t border-slate-100 p-4 dark:border-slate-800" onSubmit={event => { event.preventDefault(); void send(); }}><label htmlFor="hrm-help-question" className="sr-only">Ask about HRM Office</label><div className="flex items-end gap-2"><textarea ref={questionInput} id="hrm-help-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} rows={2} placeholder="How can I…?" disabled={sending} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} className={`${inputStyle} resize-none disabled:opacity-60`} /><button type="submit" aria-label="Send help question" disabled={sending || !question.trim()} className="rounded-xl bg-teal-700 p-3 text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40"><ArrowUpIcon className="h-5 w-5" /></button></div><p className="mt-2 text-[10px] leading-relaxed text-slate-400">Ask about the app. Avoid passwords and private employee details. Chat resets on refresh or New chat.</p></form>
      </> : <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loadingKnowledge ? <p role="status" className="text-sm text-slate-500">Loading help guides…</p> : article ? <article className="space-y-4"><button onClick={() => setArticle(null)} className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400"><ArrowLeftIcon className="h-4 w-4" />All guides</button><h3 className="text-lg font-semibold">{article.title}</h3><p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{article.summary}</p><ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">{article.steps.map((step, index) => <li key={index}>{step}</li>)}</ol><div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500 dark:bg-slate-800 dark:text-slate-300">{article.facts.map((fact, index) => <p key={index}>{fact}</p>)}</div>{article.faqs.length > 0 && <div><h4 className="mb-2 text-sm font-semibold">Common questions</h4>{article.faqs.map(faq => <details key={faq.question} className="border-b border-slate-100 py-3 text-sm dark:border-slate-800"><summary className="cursor-pointer font-medium">{faq.question}</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-500 dark:text-slate-300">{faq.answer}</p></details>)}</div>}<Link to={article.path} onClick={close} className="inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-medium text-white">Open the relevant page</Link><button onClick={() => { setView('chat'); setQuestion(`Explain ${article.title.toLowerCase()} step by step.`); }} className="ml-3 text-xs font-medium text-teal-700 dark:text-teal-400">Ask about this guide</button></article> : <><label htmlFor="hrm-help-search" className="sr-only">Search help guides</label><input id="hrm-help-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search assessments, profiles, roles…" className={inputStyle} /><p className="my-3 text-xs text-slate-500">Guidance for your {role === 'hr' ? 'HR' : role} account</p><div className="space-y-2">{filteredArticles.map(item => <button key={item.id} onClick={() => setArticle(item)} className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-teal-400 dark:border-slate-700"><h3 className="text-sm font-medium">{item.title}</h3><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{item.summary}</p></button>)}</div>{!filteredArticles.length && !knowledgeError && <p className="mt-4 text-sm text-slate-500">No guide matches this search. Try another phrase or ask the assistant.</p>}</>}
      </div>}
    </section>}
  </>;
}
