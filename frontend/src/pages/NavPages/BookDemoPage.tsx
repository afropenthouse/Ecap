import { useState } from "react";
import { Link } from "react-router-dom";
import { CalenderIcon } from "../../icons";
import { ArrowRightIcon, ChartBarIcon, CheckCircleIcon, ClockIcon, ShieldCheckIcon, UsersIcon } from "@heroicons/react/24/outline";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/input/Select";

export default function BookDemoPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    role: "",
    date: "",
    time: "",
    timePeriod: "AM",
    attendees: "1-5",
    message: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.name || !formData.email || !formData.company || !formData.role || !formData.date || !formData.time) {
        throw new Error('Please fill in all required fields');
      }

      // Prepare data for w3forms
      const w3formData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        w3formData.append(key, value);
      });

      const formId = import.meta.env.VITE_W3FORMS_FORM_ID;
      if (!formId) throw new Error('Demo booking is not configured yet. Please contact us directly.');
      const w3formsUrl = `https://w3forms.com/api/forms/public/submit/${encodeURIComponent(formId)}`;

      // Add a title/subject for the email
      w3formData.append('title', 'New Demo Booking Request');

      const response = await fetch(w3formsUrl, {
        method: 'POST',
        body: w3formData,
      });

      if (!response.ok) {
        throw new Error('Failed to submit demo request. Please try again.');
      }

      setSuccess(true);
    } catch (err) {
      console.error('Error submitting form:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit demo request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl py-8 sm:py-12">
      <div className="grid overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5 dark:border-gray-700 dark:bg-gray-900 lg:grid-cols-[.82fr_1.18fr]">
        <aside className="relative isolate overflow-hidden bg-[#101b37] px-7 py-9 text-white sm:px-10 sm:py-12">
          <div className="absolute -right-24 -top-24 -z-10 size-80 rounded-full bg-indigo-500/25 blur-3xl" />
          <h1 className="mt-6 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">See what your people data can do.</h1>
          <p className="mt-4 max-w-md leading-7 text-slate-300">Tell us a little about your organization. We’ll tailor the session to your goals and show you how HRM Office can help.</p>
          <div className="mt-9 space-y-5">
            <div className="flex gap-3"><div className="rounded-xl bg-white/10 p-2.5"><ChartBarIcon className="size-5 text-cyan-200" /></div><div><h2 className="font-medium">A walkthrough built around you</h2><p className="mt-1 text-sm leading-6 text-slate-400">Explore competency assessment, gap analysis, and reporting.</p></div></div>
            <div className="flex gap-3"><div className="rounded-xl bg-white/10 p-2.5"><UsersIcon className="size-5 text-cyan-200" /></div><div><h2 className="font-medium">Bring your real priorities</h2><p className="mt-1 text-sm leading-6 text-slate-400">Share your team size, use cases, and questions with our team.</p></div></div>
            <div className="flex gap-3"><div className="rounded-xl bg-white/10 p-2.5"><ClockIcon className="size-5 text-cyan-200" /></div><div><h2 className="font-medium">Choose a convenient time</h2><p className="mt-1 text-sm leading-6 text-slate-400">Send your preferred slot and we’ll reach out to confirm.</p></div></div>
          </div>
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.07] p-4"><div className="flex items-center gap-2 text-sm font-medium"><ShieldCheckIcon className="size-5 text-emerald-300" /> Your information stays private</div><p className="mt-2 pl-7 text-xs leading-5 text-slate-400">We’ll only use your details to respond to this demo request.</p></div>
        </aside>

        <section className="px-6 py-8 sm:px-10 sm:py-10 lg:px-12">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-cyan-300">Let’s get to know your needs</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Request your demo</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Complete the form and our team will contact you to confirm.</p>
          </div>

            {success ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-300">
                <svg className="mx-auto mb-4 size-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <h2 className="text-2xl font-bold mb-2">Thank you for booking a demo!</h2>
                <p className="mb-4">Your request has been received. Our team will contact you soon to confirm your demo session.</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Link to="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">Back to Home</Link>
                  <button onClick={() => { setSuccess(false); setFormData({ name: "", email: "", company: "", role: "", date: "", time: "", timePeriod: "AM", attendees: "1-5", message: "" }); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition">Book Another Demo</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <Label>Full Name<span className="text-error-500">*</span></Label>
                    <Input
                      type="text"
                      name="name"
                      placeholder="Your name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div>
                    <Label>Email<span className="text-error-500">*</span></Label>
                    <Input
                      type="email"
                      name="email"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <Label>Company Name<span className="text-error-500">*</span></Label>
                    <Input
                      type="text"
                      name="company"
                      placeholder="Your company"
                      value={formData.company}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div>
                    <Label>Your Role<span className="text-error-500">*</span></Label>
                    <Select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      required
                      options={[
                        { value: "", label: "Select your role" },
                        { value: "executive", label: "Executive/C-Level" },
                        { value: "manager", label: "Manager" },
                        { value: "director", label: "Director" },
                        { value: "other", label: "Other" }
                      ]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <Label>Preferred Date<span className="text-error-500">*</span></Label>
                    <div className="relative">
                      <Input
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleChange}
                        className="pl-3 pr-10 dark:text-white"
                        required
                      />
                      <CalenderIcon className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-gray-400 dark:text-gray-300 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <Label>Preferred Time<span className="text-error-500">*</span></Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type="time"
                          name="time"
                          value={formData.time}
                          onChange={handleChange}
                          className="w-full dark:text-white"
                          required
                        />
                      </div>
                      <Select
                        name="timePeriod"
                        value={formData.timePeriod}
                        onChange={handleChange}
                        options={[
                          { value: "AM", label: "AM" },
                          { value: "PM", label: "PM" }
                        ]}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Number of Attendees</Label>
                  <Select
                    name="attendees"
                    value={formData.attendees}
                    onChange={handleChange}
                    options={[
                      { value: "1-5", label: "1-5 people" },
                      { value: "6-10", label: "6-10 people" },
                      { value: "10+", label: "10+ people" }
                    ]}
                  />
                </div>

                <div>
                  <Label>Anything specific you'd like to see?</Label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    rows={4}
                    placeholder="Tell us about your goals or the features you’d like to explore"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Sending request…' : <>Request my demo <ArrowRightIcon className="size-4" /></>}
                </button>
                {error && <div className="text-red-600 dark:text-red-400 text-center mt-2">{error}</div>}
              </form>
            )}
        </section>
      </div>
    </main>
  );
}
