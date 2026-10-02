import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password !== confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      await api.post('/auth/accept-invite', { token, password });
      navigate('/auth/login', { replace: true, state: { message: 'Invitation accepted. Sign in with your work email.' } });
    } catch (e: any) {
      setError(e?.message || 'Invitation could not be accepted');
    } finally { setBusy(false); }
  };
  return <main className="mx-auto mt-16 max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Join your team</h1>
    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Set a password to activate your HRM Office account.</p>
    {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <input required minLength={8} type="password" autoComplete="new-password" placeholder="Password (at least 8 characters)" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded border p-3 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
      <input required minLength={8} type="password" autoComplete="new-password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full rounded border p-3 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
      <button disabled={busy || !token} className="w-full rounded bg-blue-600 p-3 font-medium text-white disabled:opacity-50">{busy ? 'Accepting invitation…' : 'Set password and join'}</button>
    </form>
    <Link className="mt-4 block text-sm text-blue-600" to="/auth/login">Back to sign in</Link>
  </main>;
}
