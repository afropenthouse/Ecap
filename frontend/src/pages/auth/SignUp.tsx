import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signupOrganizationAdmin } from '../../api/services';

function EyeIcon({ visible }: { visible: boolean }) {
  return visible
    ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8"/><path strokeLinecap="round" strokeLinejoin="round" d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.3 9.5 7-.4 1.1-1.3 2.5-2.6 3.7M6.2 6.2C4.3 7.5 3 9.5 2.5 12c.9 2.7 4.5 7 9.5 7 1.2 0 2.3-.2 3.3-.6"/></svg>
    : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"/><circle cx="12" cy="12" r="3"/></svg>;
}

export default function SignUp() {
  const [form, setForm] = useState({ organizationName: '', organizationEmail: '', firstName: '', lastName: '', adminEmail: '', adminPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const update = (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [event.target.name]: event.target.value });
  const passwordRules = [
    { label: 'At least 8 characters', valid: form.adminPassword.length >= 8 },
    { label: 'One uppercase letter', valid: /[A-Z]/.test(form.adminPassword) },
    { label: 'One lowercase letter', valid: /[a-z]/.test(form.adminPassword) },
    { label: 'One number', valid: /\d/.test(form.adminPassword) },
    { label: 'One symbol', valid: /[^A-Za-z0-9]/.test(form.adminPassword) },
  ];
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (passwordRules.some(rule => !rule.valid)) {
      setError('Choose a password that meets all the requirements below.');
      return;
    }
    if (form.adminPassword !== form.confirmPassword) {
      setError('Passwords do not match. Please check both password fields.');
      return;
    }
    setBusy(true);
    try {
      await signupOrganizationAdmin({
        organizationName: form.organizationName,
        organizationEmail: form.organizationEmail || form.adminEmail,
        firstName: form.firstName,
        lastName: form.lastName,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
      });
      sessionStorage.setItem('pendingEmail', form.adminEmail);
      navigate('/auth/email-confirmation', { state: { email: form.adminEmail, message: 'Check your inbox to verify your account.' } });
    } catch (e: any) { setError(e?.message || 'Could not create your organization'); }
    finally { setBusy(false); }
  };
  const inputClass = 'mt-1 w-full rounded-md border border-gray-300 bg-white p-3 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500';
  return <main className="mx-auto my-12 max-w-xl rounded-xl border border-gray-200 bg-white p-8 text-gray-900 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-white">
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create your organization</h1>
    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Set up your company workspace and HR administrator profile. We’ll verify your work email before you enter the workspace.</p>
    <ol className="mt-6 grid grid-cols-2 gap-3 text-xs sm:text-sm" aria-label="Onboarding progress">
      <li className="rounded-lg border border-blue-500 bg-blue-50 p-3 font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-200">1. Company and HR profile</li>
      <li className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">2. Verify work email</li>
    </ol>
    {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block text-sm font-medium">Company name<input required name="organizationName" value={form.organizationName} onChange={update} className={inputClass} /></label>
      <label className="block text-sm font-medium">Company email <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span><input type="email" name="organizationEmail" value={form.organizationEmail} onChange={update} className={inputClass} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">HR first name<input required name="firstName" value={form.firstName} onChange={update} className={inputClass} /></label>
        <label className="block text-sm font-medium">HR last name<input required name="lastName" value={form.lastName} onChange={update} className={inputClass} /></label>
      </div>
      <label className="block text-sm font-medium">HR work email<input required type="email" name="adminEmail" value={form.adminEmail} onChange={update} className={inputClass} /></label>
      <label className="block text-sm font-medium">Password<div className="relative mt-1">
        <input required minLength={8} autoComplete="new-password" type={showPassword ? 'text' : 'password'} name="adminPassword" value={form.adminPassword} onChange={update} className={`${inputClass} pr-12`} />
        <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white">
          <EyeIcon visible={showPassword} />
        </button>
      </div></label>
      <ul className="grid grid-cols-1 gap-1.5 rounded-lg bg-gray-50 p-3 text-xs sm:grid-cols-2 dark:bg-gray-800/70" aria-label="Password requirements">
        {passwordRules.map(rule => <li key={rule.label} className={rule.valid ? 'flex items-center gap-2 text-emerald-700 dark:text-emerald-300' : 'flex items-center gap-2 text-gray-500 dark:text-gray-400'}><span aria-hidden="true">{rule.valid ? '✓' : '○'}</span>{rule.label}</li>)}
      </ul>
      <label className="block text-sm font-medium">Confirm password<div className="relative mt-1">
        <input required minLength={8} autoComplete="new-password" type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={form.confirmPassword} onChange={update} aria-invalid={!!form.confirmPassword && form.confirmPassword !== form.adminPassword} className={`${inputClass} pr-12 ${form.confirmPassword && form.confirmPassword !== form.adminPassword ? 'border-red-500 dark:border-red-400' : ''}`} />
        <button type="button" onClick={() => setShowConfirmPassword(value => !value)} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} aria-pressed={showConfirmPassword} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"><EyeIcon visible={showConfirmPassword} /></button>
      </div>{form.confirmPassword && form.confirmPassword !== form.adminPassword && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">Passwords do not match.</span>}</label>
      <button disabled={busy} className="w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-50">{busy ? 'Creating workspace…' : 'Create workspace'}</button>
    </form>
    <p className="mt-5 text-sm text-gray-600 dark:text-gray-400">Already have an account? <Link className="text-blue-600" to="/auth/login">Sign in</Link></p>
  </main>;
}
