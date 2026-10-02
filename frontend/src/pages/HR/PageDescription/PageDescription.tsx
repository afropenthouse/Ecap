import { UserIcon, GroupIcon, BoxIcon, PieChartIcon } from "../../../icons";
import { useCallback, useEffect, useState } from "react";
import { listUsers, type UserSummary } from "../../../api/services";
import { useAuth } from "../../../context/AuthContext";

function PageDescription() {
  const { organization } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState("");
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUsersError("");
    try {
      setUsers(await listUsers());
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : "Unable to load organization metrics.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);
  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const activeUsers = users.filter(user => user.isActive !== false && user.accountStatus === "ACTIVE");
  const employeeCount = activeUsers.filter(user => user.role === "EMPLOYEE").length;
  const assessorCount = activeUsers.filter(user => user.role === "ASSESSOR").length;
  const pendingCount = users.filter(user => user.isActive !== false && user.accountStatus === "PENDING").length;
  const metricValue = (value: number) => loadingUsers || usersError ? "—" : value.toLocaleString();
  return (
    <div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-8 dark:from-gray-800/50 dark:to-gray-900/50 dark:border dark:border-gray-800">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\") " }}></div>

      {/* Content */}
      <div className="relative">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">
              {organization?.name || "HR workspace"}
            </h1>
            <p className="max-w-2xl text-gray-600 dark:text-gray-400">
              Our Human Resources team is the heart of HRM office, dedicated to fostering a vibrant and high-performing workforce. We empower our people, cultivate talent, and champion a culture of growth and innovation, ensuring every member of our team can contribute to shaping Nigeria's digital energy future
              
            </p>
          </div>
          </div>

        {/* Live organization metrics */}
        {usersError && <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          <span>Could not load organization metrics. {usersError}</span>
          <button type="button" onClick={() => void loadUsers()} className="font-semibold underline underline-offset-2">Try again</button>
        </div>}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white/50 p-4 dark:bg-white/[0.03]">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <GroupIcon className="size-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active team</p>
                <p aria-live="polite" className="text-xl font-semibold text-gray-900 dark:text-white">{metricValue(activeUsers.length)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white/50 p-4 dark:bg-white/[0.03]">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <BoxIcon className="size-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Employees</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{metricValue(employeeCount)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white/50 p-4 dark:bg-white/[0.03]">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <PieChartIcon className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Assessors</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{metricValue(assessorCount)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white/50 p-4 dark:bg-white/[0.03]">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <UserIcon className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pending activation</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{metricValue(pendingCount)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

export default PageDescription;
