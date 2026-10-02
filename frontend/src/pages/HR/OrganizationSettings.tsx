import { useEffect, useState } from 'react';
import { getMyOrganization, updateMyOrganization, uploadImage } from '../../api/services';
import { useAuth } from '../../context/AuthContext';

type ProfileForm = { name: string; email: string; address: string; logoUrl: string };
const emptyProfile: ProfileForm = { name: '', email: '', address: '', logoUrl: '' };

export default function OrganizationSettings() {
  const { updateOrganization } = useAuth();
  const [form, setForm] = useState<ProfileForm>(emptyProfile);
  const [savedForm, setSavedForm] = useState<ProfileForm>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const hasChanges = JSON.stringify(form) !== JSON.stringify(savedForm);

  useEffect(() => {
    getMyOrganization()
      .then(org => {
        const profile = { name: org.name || '', email: org.email || '', address: org.address || '', logoUrl: org.logoUrl || '' };
        setForm(profile);
        setSavedForm(profile);
      })
      .catch(error => {
        setMessage(error.message || 'Unable to load the company profile.');
        setMessageType('error');
      })
      .finally(() => setLoading(false));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const org = await updateMyOrganization(form);
      const profile = { name: org.name || '', email: org.email || '', address: org.address || '', logoUrl: org.logoUrl || '' };
      setForm(profile);
      setSavedForm(profile);
      updateOrganization(org);
      setMessage('Company profile updated. Your workspace branding is now up to date.');
      setMessageType('success');
    } catch (error: any) {
      setMessage(error?.message || 'Unable to save the company profile. Please try again.');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const maxLogoSize = 5 * 1024 * 1024;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setMessage('Choose a JPEG or PNG image for your company logo.');
      setMessageType('error');
      event.target.value = '';
      return;
    }
    if (file.size > maxLogoSize) {
      setMessage('Company logos must be 5 MB or smaller.');
      setMessageType('error');
      event.target.value = '';
      return;
    }
    setUploadingLogo(true);
    setMessage('');
    try {
      const uploaded = await uploadImage(file, 'organization-logos');
      setForm(current => ({ ...current, logoUrl: uploaded.url }));
      setMessage('Logo uploaded. Save your profile to publish it across the workspace.');
      setMessageType('info');
    } catch (error: any) {
      setMessage(error?.message || 'Logo upload failed. Please try again.');
      setMessageType('error');
    } finally {
      setUploadingLogo(false);
      event.target.value = '';
    }
  };

  const fieldClass = 'mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500';
  const labelClass = 'block text-sm font-semibold text-gray-800 dark:text-gray-100';

  return <section className="mx-auto w-full max-w-5xl p-5 sm:p-7">
    <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 9h.01M15 9h.01M9 12h.01M15 12h.01" /></svg>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Company workspace</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-950 dark:text-white">Organization settings</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400">Keep your company details and workspace identity current for your team.</p>
        </div>
      </div>
    </header>

    <div className="space-y-6">
      {message && <div role="status" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${messageType === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200' : messageType === 'error' ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200' : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200'}`}>
        <span className="mt-0.5 font-bold" aria-hidden="true">{messageType === 'success' ? '✓' : messageType === 'error' ? '!' : 'i'}</span><span>{message}</span>
      </div>}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/30 bg-white p-2 text-2xl font-bold text-blue-700 shadow-inner">
            {form.logoUrl ? <img src={form.logoUrl} alt={`${form.name || 'Company'} logo`} className="size-full rounded-xl object-contain" /> : (form.name.trim().charAt(0).toUpperCase() || 'C')}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Workspace identity</p>
            <h2 className="mt-1 break-words text-2xl font-bold">{form.name || (loading ? 'Loading company...' : 'Your company name')}</h2>
            <p className="mt-1 break-all text-sm text-blue-100">{form.email || 'Add a company email address'}</p>
          </div>
          <span className="sm:ml-auto sm:self-start rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-blue-50">Live preview</span>
        </div>
      </div>

      <form onSubmit={submit} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:px-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Company details</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">These details identify your organization throughout HRM Office.</p>
        </div>

        <div className="space-y-6 px-6 py-6 sm:px-8">
          {loading ? <div className="space-y-5" aria-label="Loading company profile">
            <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          </div> : <>
            <label className={labelClass}>Company name<input required maxLength={120} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className={fieldClass} placeholder="e.g. Northstar Consulting" /></label>
            <div className="grid gap-6 md:grid-cols-2">
              <label className={labelClass}>Company email<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className={fieldClass} placeholder="people@company.com" /></label>
              <label className={labelClass}>Office address<span className="ml-2 font-normal text-gray-400">Optional</span><textarea rows={2} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} className={`${fieldClass} resize-y`} placeholder="Street address, city, country" /></label>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-800 dark:bg-white/[0.025]">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white text-xl font-bold text-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:text-blue-300">
                  {form.logoUrl ? <img src={form.logoUrl} alt="Company logo preview" className="size-full object-contain p-1" /> : (form.name.trim().charAt(0).toUpperCase() || 'C')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Company logo</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">JPEG or PNG, up to 5 MB. A square image fits best. Your saved logo appears in the workspace header.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
                      {uploadingLogo ? 'Uploading...' : form.logoUrl ? 'Replace logo' : 'Upload logo'}
                      <input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" disabled={uploadingLogo} onChange={uploadLogo} className="sr-only" />
                    </label>
                    {form.logoUrl && <button type="button" onClick={() => setForm({ ...form, logoUrl: '' })} className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400">Remove logo</button>}
                  </div>
                </div>
              </div>
            </div>
          </>}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50/70 px-6 py-4 dark:border-gray-800 dark:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-xs text-gray-500 dark:text-gray-400">Changes update your workspace branding after you save.</p>
          <button disabled={saving || loading || uploadingLogo || !hasChanges} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Saving profile...' : 'Save changes'}
            {!saving && <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-4"><path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.69L10.22 5.03a.75.75 0 111.06-1.06l5.5 5.5a.75.75 0 010 1.06l-5.5 5.5a.75.75 0 11-1.06-1.06l4.22-4.22H3.75A.75.75 0 013 10z" clipRule="evenodd" /></svg>}
          </button>
        </div>
      </form>
    </div>
  </section>;
}
