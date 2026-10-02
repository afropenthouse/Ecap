import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ThemeToggleButton } from "../../components/common/ThemeToggleButton";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";

function PasswordEye({ visible }: { visible: boolean }) {
  return visible
    ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8"/><path strokeLinecap="round" strokeLinejoin="round" d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.3 9.5 7-.4 1.1-1.3 2.5-2.6 3.7M6.2 6.2C4.3 7.5 3 9.5 2.5 12c.9 2.7 4.5 7 9.5 7 1.2 0 2.3-.2 3.3-.6"/></svg>
    : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"/><circle cx="12" cy="12" r="3"/></svg>;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [searchParams] = useSearchParams();
  const organizationId = searchParams.get('organizationId') || undefined;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setLoadingMessage("Authenticating...");

    try {
      if (!email || !password) {
        throw new Error("Please enter your work email and password");
      }
      if (!email.includes('@')) {
        throw new Error("Please enter a valid email address");
      }

      setLoadingMessage("Authenticating...");
      const loggedInUser = await signIn(email, password, organizationId);

      // Determine redirect based on role from returned user
      const role = loggedInUser?.roles?.[0] || 'employee';
      setLoadingMessage("Redirecting...");
      if (role === 'hr') {
        navigate("/page-description");
      } else if (role === 'assessor') {
        navigate("/page-description");
      } else {
        navigate("/page-description");
      }
    } catch (error) {
      console.error("Login error:", error);
      const msg = error instanceof Error ? error.message : 'An error occurred during login';
      if (msg === 'PASSWORD_CHANGE_REQUIRED') {
        setPasswordChangeOpen(true);
        setError('');
        return;
      }
      // If backend enforces email verification, redirect user to verification page
      if (msg.toLowerCase().includes('email not verified')) {
        sessionStorage.setItem('pendingEmail', email);
        navigate('/auth/email-confirmation', { state: { email } });
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const activateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      return setError('Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol.');
    }
    setLoading(true);
    try {
      await api.post('/auth/first-login', { email, temporaryPassword: password, newPassword, ...(organizationId ? { organizationId } : {}) });
      const loggedInUser = await signIn(email, newPassword, organizationId);
      const role = loggedInUser?.roles?.[0] || 'employee';
      setPasswordChangeOpen(false);
      if (role === 'hr') navigate('/page-description');
      else if (role === 'assessor') navigate('/page-description');
      else navigate('/page-description');
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : 'Could not activate your account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="flex justify-between items-center">
          <Link to="/" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            Back to Dashboard
          </Link>
          <ThemeToggleButton />
        </div>

        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Or{" "}
            <Link
              to="/auth/signup"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              create a company workspace
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {loading && !error && (
            <div className="bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 p-3 rounded-md text-sm flex items-center">
              <svg className="animate-spin mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {loadingMessage || "Signing in..."}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-800 mb-4"
                placeholder="Email&nbsp;address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-800 mb-4"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {loadingMessage || "Signing in..."}
                </span>
              ) : (
                "Sign in"
              )}
            </button>

            <div className="mt-4 text-center">
              <Link
                to="/auth/forgot-password"
                className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Forgot your password?
              </Link>
            </div>
          </div>
        </form>

        {passwordChangeOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="activate-title" className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" aria-hidden="true">âœ“</div>
            <h2 id="activate-title" className="text-xl font-bold text-gray-900 dark:text-white">Activate your account</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Create a personal password to replace the temporary password from your invitation.</p>
            {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
            <form onSubmit={activateAccount} className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-gray-800 dark:text-gray-100">New password<div className="relative mt-1">
                <input required minLength={8} autoComplete="new-password" type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white p-3 pr-12 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                <button type="button" onClick={() => setShowNewPassword(value => !value)} aria-label={showNewPassword ? 'Hide new password' : 'Show new password'} aria-pressed={showNewPassword} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"><PasswordEye visible={showNewPassword} /></button>
              </div></label>
              <label className="block text-sm font-medium text-gray-800 dark:text-gray-100">Confirm password<div className="relative mt-1">
                <input required minLength={8} autoComplete="new-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white p-3 pr-12 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                <button type="button" onClick={() => setShowConfirmPassword(value => !value)} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} aria-pressed={showConfirmPassword} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"><PasswordEye visible={showConfirmPassword} /></button>
              </div></label>
              <p className="text-xs text-gray-500 dark:text-gray-400">Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol.</p>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setPasswordChangeOpen(false); setNewPassword(''); setConfirmPassword(''); setError(''); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200">Cancel</button>
                <button disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Activating...' : 'Save password and continue'}</button>
              </div>
            </form>
          </section>
        </div>}

        {/* Info note */}
        <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
          <p className="font-medium mb-2">Sign-in Info:</p>
          <p>Use your work email and password. If HR invited you, start with the temporary password in your invitation email.</p>
        </div>
      </div>
    </div>
  );
}
