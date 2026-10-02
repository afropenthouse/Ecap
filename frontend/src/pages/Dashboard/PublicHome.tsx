import { ArrowRightIcon, CheckCircleIcon, ChartBarIcon, UsersIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import EmployeeDistributionChart from "../AllDashboard/EmployeeDistributionChart";
import CompetencyGapAnalysis from "../AllDashboard/CompetencyGapAnalysis";

const benefits = [
  "Clear visibility into workforce strengths",
  "Consistent, structured employee assessments",
  "Actionable insight for learning and growth",
];

export default function PublicHome() {
  return (
    <main className="mx-auto max-w-7xl pb-16 text-slate-900 dark:text-white">
      <section className="overflow-hidden rounded-[2rem] bg-[#101b37] px-6 py-10 text-white shadow-xl shadow-indigo-950/10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_.98fr] lg:gap-12">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-2 text-xs font-semibold tracking-wide text-indigo-100">
              <span className="size-2 rounded-full bg-emerald-400" /> PEOPLE. PERFORMANCE. PROGRESS.
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.45rem]">
              Build a stronger workforce, <span className="text-cyan-300">one competency at a time.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              HRM Office helps you understand the skills your people have today and the capabilities your organization needs next.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/book-demo" className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
                Book a personalized demo <ArrowRightIcon className="size-4" />
              </Link>
              <Link to="/auth/signup" className="inline-flex items-center justify-center rounded-xl border border-white/20 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10">
                Get started
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
              {benefits.map((benefit) => <span key={benefit} className="flex items-center gap-2"><CheckCircleIcon className="size-4 text-emerald-300" />{benefit}</span>)}
            </div>
          </div>

          <div className="mx-auto w-full max-w-xl">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div><p className="text-base font-semibold tracking-tight">Workforce overview</p><p className="mt-1 text-xs text-slate-500">A snapshot of team capability</p></div>
                <div className="rounded-xl bg-indigo-50 p-2.5"><ChartBarIcon className="size-5 text-indigo-700" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3 py-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-medium text-slate-500"><UsersIcon className="size-4 text-indigo-600" />People assessed</div><p className="mt-2 text-2xl font-semibold tracking-tight">1,248</p><p className="mt-1 text-xs text-slate-500">Across your organization</p></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">Competency coverage</p><p className="mt-2 text-2xl font-semibold tracking-tight">78%</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-[78%] rounded-full bg-indigo-600" /></div></div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold">Assessment progress</p><p className="mt-1 text-xs text-slate-500">Completed assessments over time</p></div><span className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700">This year</span></div>
                <div className="relative h-28 border-b border-l border-slate-200 px-2">
                  <div className="absolute inset-x-0 top-1/4 border-t border-dashed border-slate-200" />
                  <div className="absolute inset-x-0 top-2/4 border-t border-dashed border-slate-200" />
                  <div className="absolute inset-x-0 top-3/4 border-t border-dashed border-slate-200" />
                  <div className="absolute inset-0 flex items-end justify-around gap-2 px-3">
                    {[42, 58, 48, 74, 63, 88, 78, 100, 86, 94, 74, 100].map((height, index) => <div key={index} className={`w-full max-w-5 rounded-t-sm ${index > 8 ? "bg-cyan-500" : "bg-indigo-600"}`} style={{ height: `${height}%` }} />)}
                  </div>
                </div>
                <div className="mt-2 flex justify-between pl-2 text-[10px] font-medium text-slate-400"><span>Jan</span><span>Mar</span><span>May</span><span>Jul</span><span>Sep</span><span>Nov</span></div>
              </div>
              <p className="mt-3 text-center text-[11px] text-slate-400">Illustrative dashboard preview</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-cyan-300">From insight to impact</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Know where your team stands</h2>
          <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">Bring workforce capability into focus with simple, visual reporting that helps leaders make confident development decisions.</p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <EmployeeDistributionChart />
          <CompetencyGapAnalysis />
        </div>
      </section>

      <section className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-indigo-50 px-6 py-8 dark:bg-white/[0.05] sm:flex-row sm:items-center sm:px-9">
        <div><h2 className="text-xl font-semibold">Ready to make talent decisions with confidence?</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">See how HRM Office can support your people strategy.</p></div>
        <Link to="/book-demo" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700">Talk to our team <ArrowRightIcon className="size-4" /></Link>
      </section>
    </main>
  );
}
