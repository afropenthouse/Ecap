import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../../context/AuthContext';
import { deleteOrganizationUser, inviteOrganizationMember, setOrganizationUserActive } from '../../../../api/services';

interface User {
  id: string;
  email: string;
  roles: string[];
  displayRole?: string;
  firstName?: string | null;
  lastName?: string | null;
  accountStatus?: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'DEACTIVATED';
  isActive?: boolean;
}

interface UsersTabProps {
  users: User[];
  loadingUsers: boolean;
  usersError?: string;
  fetchUsers: () => Promise<void>;
}

export default function UsersTab({ users, loadingUsers, usersError, fetchUsers }: UsersTabProps) {
  const { user: currentUser } = useAuth();
  const [pendingAction, setPendingAction] = useState<{ user: User; action: 'deactivate' | 'activate' | 'delete' } | null>(null);
  const [openActionMenuFor, setOpenActionMenuFor] = useState<string | null>(null);
  const [updatingAccount, setUpdatingAccount] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [invite, setInvite] = useState({ firstName: '', lastName: '', email: '', role: 'EMPLOYEE' as 'EMPLOYEE' | 'ASSESSOR' | 'HR' });

  // Auto-hide success/error messages after 5 seconds
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        setErrorMessage(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  const confirmAccountAction = async () => {
    if (!pendingAction) return;
    try {
      setUpdatingAccount(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const { user, action } = pendingAction;
      if (action === 'delete') await deleteOrganizationUser(user.id);
      else await setOrganizationUserActive(user.id, action === 'activate');
      const successMsg = action === 'delete' ? 'Team member deleted.' : action === 'deactivate' ? 'Team member deactivated.' : 'Team member reactivated.';
      setSuccessMessage(successMsg);
      toast.success(successMsg);
      setPendingAction(null);
      await fetchUsers();
    } catch (error) {
      console.error('Error updating team member:', error);
      const errMsg = error instanceof Error ? error.message : 'Could not update team member';
      toast.error(errMsg);
      setErrorMessage(errMsg);
    } finally {
      setUpdatingAccount(false);
    }
  };

  const formatRoleName = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <div>
      <div className="mb-5 flex justify-end"><button onClick={() => setInviteOpen(!inviteOpen)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">{inviteOpen ? 'Close' : 'Invite team member'}</button></div>
      {inviteOpen && <form className="mb-6 grid gap-4 rounded-xl border border-gray-200 bg-white p-5 text-gray-900 sm:grid-cols-2 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white" onSubmit={async e => {
        e.preventDefault(); setInviting(true); setErrorMessage(null);
        try { await inviteOrganizationMember(invite); toast.success('Invitation sent'); setInvite({ firstName: '', lastName: '', email: '', role: 'EMPLOYEE' }); setInviteOpen(false); await fetchUsers(); }
        catch (error: any) { const msg = error?.message || 'Invitation failed'; setErrorMessage(msg); toast.error(msg); }
        finally { setInviting(false); }
      }}>
        <label className="text-sm text-gray-900 dark:text-white">First name<input required value={invite.firstName} onChange={e => setInvite({ ...invite, firstName: e.target.value })} className="mt-1 w-full rounded border p-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
        <label className="text-sm text-gray-900 dark:text-white">Last name<input required value={invite.lastName} onChange={e => setInvite({ ...invite, lastName: e.target.value })} className="mt-1 w-full rounded border p-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
        <label className="text-sm text-gray-900 dark:text-white">Work email<input required type="email" value={invite.email} onChange={e => setInvite({ ...invite, email: e.target.value })} className="mt-1 w-full rounded border p-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
        <label className="text-sm text-gray-900 dark:text-white">Role<select value={invite.role} onChange={e => setInvite({ ...invite, role: e.target.value as typeof invite.role })} className="mt-1 w-full rounded border p-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="EMPLOYEE">Employee</option><option value="ASSESSOR">Assessor</option><option value="HR">HR</option></select></label>
        <button disabled={inviting} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2">{inviting ? 'Sending invite…' : 'Send invitation'}</button>
      </form>}
      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/30 dark:bg-green-900/20">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="size-5 text-green-600 dark:text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">{successMessage}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                className="inline-flex rounded-md bg-green-50 p-1.5 text-green-500 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="size-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/20">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="size-5 text-red-600 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {usersError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
        <span>Could not refresh the team list. The rows shown may be out of date. {usersError}</span>
        <button type="button" onClick={() => void fetchUsers()} className="font-semibold underline underline-offset-2">Try again</button>
      </div>}

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="w-full min-w-0">
          <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th scope="col" className="w-[17%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white sm:px-4">Name</th>
                <th scope="col" className="w-[27%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white sm:px-4">
                  Email
                </th>
                <th scope="col" className="w-[14%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white sm:px-4">
                  Roles
                </th>
                <th scope="col" className="w-[21%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white sm:px-4">Status</th>
                <th scope="col" className="w-[21%] px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white sm:px-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-white/[0.03]">
              {loadingUsers ? (
                <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="size-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-500"></div>
                    </div>
                  </td>
                </tr>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.05]">
                    <td className="break-words px-3 py-4 text-sm text-gray-900 dark:text-white sm:px-4">{[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}</td>
                    <td className="break-all px-3 py-4 text-sm text-gray-900 dark:text-white sm:px-4">
                      {user.email}
                    </td>
                    <td className="break-words px-3 py-4 text-sm text-gray-900 dark:text-white sm:px-4">
                      {user.roles.map(role => formatRoleName(role)).join(', ')}
                    </td>
                    <td className="px-3 py-4 text-sm sm:px-4">
                      <span className={`inline-flex max-w-full whitespace-normal rounded-full px-2.5 py-1 text-xs font-semibold ${user.accountStatus === 'DEACTIVATED' ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200' : user.accountStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : user.accountStatus === 'EXPIRED' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'}`}>
                        {user.accountStatus === 'DEACTIVATED' ? 'Deactivated' : user.accountStatus === 'ACTIVE' ? 'Activated' : user.accountStatus === 'EXPIRED' ? 'Invite expired' : 'Pending activation'}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right text-sm font-medium sm:px-4">
                      <div className="relative flex justify-end" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenActionMenuFor(null); }} onKeyDown={event => { if (event.key === 'Escape') setOpenActionMenuFor(null); }}>
                        <button type="button" disabled={user.id === currentUser?.id} aria-label={`Actions for ${[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}`} aria-haspopup="menu" aria-expanded={openActionMenuFor === user.id} onClick={() => setOpenActionMenuFor(openActionMenuFor === user.id ? null : user.id)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-white/[0.08]">
                          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-5"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
                        </button>
                        {openActionMenuFor === user.id && <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-44 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                          <button type="button" role="menuitem" onClick={() => { setPendingAction({ user, action: user.isActive === false ? 'activate' : 'deactivate' }); setOpenActionMenuFor(null); setErrorMessage(null); }} className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[0.08]">{user.isActive === false ? 'Reactivate account' : 'Deactivate account'}</button>
                          <button type="button" role="menuitem" onClick={() => { setPendingAction({ user, action: 'delete' }); setOpenActionMenuFor(null); setErrorMessage(null); }} className="w-full rounded-md px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40">Delete team member</button>
                        </div>}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {usersError ? 'Team members could not be loaded.' : 'No users found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pendingAction && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="member-action-title" className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <div className={`mb-4 flex size-12 items-center justify-center rounded-full ${pendingAction.action === 'delete' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`} aria-hidden="true">{pendingAction.action === 'delete' ? '!' : 'i'}</div>
          <h2 id="member-action-title" className="text-xl font-bold text-gray-900 dark:text-white">
            {pendingAction.action === 'delete' ? 'Delete team member?' : pendingAction.action === 'deactivate' ? 'Deactivate team member?' : 'Reactivate team member?'}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {pendingAction.action === 'delete'
              ? `This will permanently remove ${pendingAction.user.firstName || pendingAction.user.email} from your organization. If they have linked records, deactivate the account to preserve its history.`
              : pendingAction.action === 'deactivate'
                ? `${pendingAction.user.firstName || pendingAction.user.email} will lose access immediately. Their records will remain in the organization.`
                : `${pendingAction.user.firstName || pendingAction.user.email} will be able to sign in to the organization again.`}
          </p>
          {errorMessage && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{errorMessage}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" disabled={updatingAccount} onClick={() => setPendingAction(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200">Cancel</button>
            <button type="button" disabled={updatingAccount} onClick={confirmAccountAction} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${pendingAction.action === 'delete' ? 'bg-red-600 hover:bg-red-700' : pendingAction.action === 'deactivate' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {updatingAccount ? 'Please wait...' : pendingAction.action === 'delete' ? 'Delete member' : pendingAction.action === 'deactivate' ? 'Deactivate account' : 'Reactivate account'}
            </button>
          </div>
        </section>
      </div>}    </div>
  );
}
