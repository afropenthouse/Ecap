import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import PasswordInput from '../components/form/input/PasswordInput';
import PageMeta from '../components/common/PageMeta';

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white';
const buttonClass = 'rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const cardClass = 'rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6';
const roleNames: Record<string, string> = { hr: 'HR', assessor: 'Assessor', employee: 'Employee' };

export default function UserProfiles() {
  const { user, organization, updateProfile } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [saving, setSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    setFirstName(user?.firstName || '');
    setLastName(user?.lastName || '');
  }, [user?.firstName, user?.lastName]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setProfileMessage(''); setProfileError(''); setSaving(true);
    try {
      await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
      setProfileMessage('Your name has been updated.');
    } catch (error) { setProfileError(error instanceof Error ? error.message : 'Could not save your profile.'); }
    finally { setSaving(false); }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordMessage(''); setPasswordError('');
    if (newPassword !== confirmPassword) { setPasswordError('The new passwords do not match.'); return; }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword)) {
      setPasswordError('Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol.'); return;
    }
    setChangingPassword(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setPasswordMessage('Your password has been changed. Use the new password next time you sign in.');
    } catch (error) { setPasswordError(error instanceof Error ? error.message : 'Could not change your password.'); }
    finally { setChangingPassword(false); }
  }

  return <div className="mx-auto max-w-4xl space-y-6 text-gray-900 dark:text-white">
    <PageMeta title="My profile | HRM Office" description="Manage your name and password and view your account role." />
    <div><h1 className="text-2xl font-bold">My profile</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage your personal details and account security.</p></div>
    <section className={cardClass} aria-label="Personal information">
      <div className="flex flex-wrap gap-2">{user?.roles.map(role => <span key={role} className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">{roleNames[role] || role}</span>)}</div>
      <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Your role controls access to workspace features. Contact your HR administrator if it needs to change.</p>
      {organization && <p className="mt-4 text-sm"><span className="text-gray-500 dark:text-gray-400">Organization: </span>{organization.name}</p>}
      <form onSubmit={saveProfile} className="mt-5 space-y-4">
        <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium"><span className="block">First name</span><input required maxLength={100} autoComplete="given-name" value={firstName} onChange={event => setFirstName(event.target.value)} className={inputClass} /></label>
          <label className="space-y-1 text-sm font-medium"><span className="block">Last name</span><input required maxLength={100} autoComplete="family-name" value={lastName} onChange={event => setLastName(event.target.value)} className={inputClass} /></label>
        </fieldset>
        <label className="block space-y-1 text-sm font-medium"><span>Email address</span><input readOnly type="email" value={user?.email || ''} aria-describedby="email-help" className={`${inputClass} bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400`} /></label>
        <p id="email-help" className="text-xs text-gray-500 dark:text-gray-400">Your sign-in email cannot be changed here.</p>
        {profileError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{profileError}</p>}
        {profileMessage && <p role="status" className="text-sm text-green-700 dark:text-green-400">{profileMessage}</p>}
        <button disabled={saving || !firstName.trim() || !lastName.trim()} className={buttonClass}>{saving ? 'Saving...' : 'Save name'}</button>
      </form>
    </section>
    <section className={cardClass} aria-labelledby="password-title">
      <h2 id="password-title" className="text-lg font-semibold">Change password</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Confirm your current password to choose a new one.</p>
      <form onSubmit={changePassword} className="mt-5 space-y-4">
        <fieldset disabled={changingPassword} className="space-y-4">
          <label className="block space-y-1 text-sm font-medium"><span>Current password</span><PasswordInput required autoComplete="current-password" passwordLabel="current password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className={inputClass} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm font-medium"><span>New password</span><PasswordInput required minLength={8} autoComplete="new-password" passwordLabel="new password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className={inputClass} /></label>
            <label className="block space-y-1 text-sm font-medium"><span>Confirm new password</span><PasswordInput required minLength={8} autoComplete="new-password" passwordLabel="confirmed password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className={inputClass} /></label>
          </div>
        </fieldset>
        <p className="text-xs text-gray-500 dark:text-gray-400">Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol.</p>
        {passwordError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>}
        {passwordMessage && <p role="status" className="text-sm text-green-700 dark:text-green-400">{passwordMessage}</p>}
        <button disabled={changingPassword} className={buttonClass}>{changingPassword ? 'Changing password...' : 'Change password'}</button>
      </form>
    </section>
  </div>;
}
