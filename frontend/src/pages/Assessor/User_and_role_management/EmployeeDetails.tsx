import React, { useEffect, useState } from 'react';
import { PencilIcon, UserIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../../context/AuthContext';
import { getDepartments, getUserProfile, updateUser, uploadImage, type Department } from '../../../api/services';

interface AssessorProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  profilePictureUrl?: string | null;
  departments?: Array<{ id: string; name: string }>;
}

const AssessorDetails: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<AssessorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ firstName: '', lastName: '', phone: '' });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const loadProfile = async (showLoader = true) => {
    if (!user?.id) return;
    try {
      if (showLoader) setLoading(true);
      setError(null);
      const [data, organizationDepartments] = await Promise.all([getUserProfile(user.id), getDepartments()]);
      setProfile(data);
      setDraft({ firstName: data.firstName || '', lastName: data.lastName || '', phone: data.phone || '' });
      setDepartments(organizationDepartments);
      setSelectedDepartmentIds((data.departments || []).map(department => department.id));
    } catch (e: any) {
      setError(e?.message || 'Failed to load assessor details');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => { void loadProfile(); }, [user?.id]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      let profilePictureUrl: string | undefined;
      if (avatarFile) {
        const uploaded = await uploadImage(avatarFile, 'avatars');
        profilePictureUrl = uploaded.url;
      }
      await updateUser(profile.id, {
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        phone: draft.phone.trim(),
        profilePictureUrl,
        departmentIds: selectedDepartmentIds,
      });
      await loadProfile(false);
      setAvatarFile(null);
      setShowEditModal(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to update assessor details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><div className="size-10 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-600" /></div>;
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Your account</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Assessor Details</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Your personal assessor profile.</p>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

      {profile && (
        <article className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="h-28 bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-600" />
          <div className="px-6 pb-7 sm:px-8">
            <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                {profile.profilePictureUrl ? (
                  <img src={profile.profilePictureUrl} alt={`${profile.firstName} ${profile.lastName}`} className="size-24 rounded-2xl border-4 border-white object-cover shadow-md dark:border-gray-900" />
                ) : (
                  <div className="flex size-24 items-center justify-center rounded-2xl border-4 border-white bg-blue-50 text-blue-600 shadow-md dark:border-gray-900 dark:bg-blue-950 dark:text-blue-300"><UserIcon className="size-12" /></div>
                )}
                <div className="pb-1">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{profile.firstName} {profile.lastName}</h2>
                  <span className="mt-1 inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">Assessor</span>
                </div>
              </div>
              <button type="button" onClick={() => setShowEditModal(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
                <PencilIcon className="size-4" /> Edit details
              </button>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Work email</p>
                <p className="mt-2 break-all text-sm font-medium text-gray-900 dark:text-white">{profile.email}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Phone number</p>
                <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{profile.phone || 'Not provided'}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/60 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Departments</p>
                {profile.departments?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">{profile.departments.map(department => <span key={department.id} className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">{department.name}</span>)}</div>
                ) : <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No departments assigned</p>}
              </div>
            </div>
          </div>
        </article>
      )}

      {showEditModal && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={handleSave} className="max-h-[80vh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit assessor details</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update your name, phone number, or profile photo.</p></div>
              <button type="button" onClick={() => setShowEditModal(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close"><XMarkIcon className="size-5" /></button>
            </div>
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">First name<input required value={draft.firstName} onChange={e => setDraft({ ...draft, firstName: e.target.value })} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white" /></label>
              <label className="space-y-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Last name<input required value={draft.lastName} onChange={e => setDraft({ ...draft, lastName: e.target.value })} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white" /></label>
            </div>
            <label className="block space-y-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Phone number<input type="tel" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white" /></label>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Departments</legend>
              {departments.length ? <div className="grid max-h-32 gap-1 overflow-y-auto rounded-xl border border-gray-200 p-2 sm:grid-cols-2 dark:border-gray-700">
                {departments.map(department => <label key={department.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800">
                  <input type="checkbox" checked={selectedDepartmentIds.includes(department.id)} onChange={event => setSelectedDepartmentIds(current => event.target.checked ? [...current, department.id] : current.filter(id => id !== department.id))} className="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span>{department.name}</span>
                </label>)}
              </div> : <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">No organization departments are available yet.</p>}
              <p className="text-xs font-normal text-gray-500 dark:text-gray-400">Choose the departments you assess. You can select more than one.</p>
            </fieldset>
            <label className="block space-y-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Profile photo<input type="file" accept="image/jpeg,image/png" onChange={e => { const file = e.target.files?.[0]; if (file && !['image/jpeg', 'image/png'].includes(file.type)) { setError('Choose a JPEG or PNG photo.'); e.target.value = ''; return; } if (file && file.size > 5 * 1024 * 1024) { setError('Photo must be 5MB or smaller.'); e.target.value = ''; return; } setError(null); setAvatarFile(file || null); }} className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700 dark:text-gray-300 dark:file:bg-blue-950 dark:file:text-blue-200" /><span className="text-xs font-normal text-gray-500 dark:text-gray-400">JPEG or PNG, up to 5MB.</span></label>
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
              <button type="button" onClick={() => setShowEditModal(false)} disabled={saving} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

export default AssessorDetails;
