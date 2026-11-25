"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Users,
  ShieldCheck,
  Headset,
  HardHat,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  Check,
  X,
  UserCheck,
  UserX,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

type UserRole =
  | "super_admin"
  | "customer_service"
  | "field_worker";

type UserStatus = "pending" | "approved" | "rejected";

type ManagedUser = {
  id: string;
  fullName: string | null;
  email: string | null;
  role: UserRole | null;
  status: UserStatus;
  teamId: string | null;
  mustChangePassword: boolean;
};

type TeamOption = { id: string; name: string };

const roleOptions: { value: UserRole; label: string }[] = [
  { value: "super_admin", label: "Admin" },
  { value: "customer_service", label: "Customer Service" },
  { value: "field_worker", label: "Field Team" },
];

const roleLabels: Record<UserRole, string> = {
  super_admin: "Admin",
  customer_service: "Customer Service",
  field_worker: "Field Team",
};

const roleColors: Record<UserRole, string> = {
  super_admin: "border-indigo-200 bg-indigo-50 text-indigo-800",
  customer_service: "border-sky-200 bg-sky-50 text-sky-800",
  field_worker: "border-amber-200 bg-amber-50 text-amber-800",
};

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const statusColors: Record<UserStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-red-200 bg-red-50 text-red-700",
};

// UI-only class tokens (same look as the other admin pages).
const inputBase =
  "w-full rounded-none border border-slate-300 bg-white text-sm text-slate-800 shadow-sm placeholder:text-slate-400 transition-colors focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";
const labelClass = "mb-1.5 block text-sm font-bold text-slate-800";

function isUserRole(value: unknown): value is UserRole {
  return (
    value === "super_admin" ||
    value === "customer_service" ||
    value === "field_worker"
  );
}

function isUserStatus(value: unknown): value is UserStatus {
  return (
    value === "pending" || value === "approved" || value === "rejected"
  );
}

export default function UserManagement({
  onPendingChange,
}: {
  // Lets the navigation badge stay in sync with this page.
  // The parent must pass a stable function (a useState setter or a
  // useCallback), otherwise the list reloads on every render.
  onPendingChange?: (count: number) => void;
}) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);

  const [editingUser, setEditingUser] =
    useState<ManagedUser | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] =
    useState<UserRole>("customer_service");
  const [teamId, setTeamId] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Account waiting for delete confirmation (styled dialog)
  const [deleteTarget, setDeleteTarget] =
    useState<ManagedUser | null>(null);

  // Approve / reject dialog for pending (or rejected) accounts
  const [approveTarget, setApproveTarget] =
    useState<ManagedUser | null>(null);
  const [approveRole, setApproveRole] = useState<UserRole | "">("");
  const [approveTeamId, setApproveTeamId] = useState("");
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState("");

  // Load users from the API.
  // `silent` = background refresh: no skeleton, no error banner, keeps the
  // current list if the request fails.
  const loadUsers = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError("");
      }

      try {
        const response = await fetch("/api/admin/users", {
          method: "GET",
          cache: "no-store",
        });

        // A signed-out session is redirected to the login page (HTML, not JSON).
        if (
          response.redirected ||
          !response.headers
            .get("content-type")
            ?.includes("application/json")
        ) {
          window.location.href = "/login";
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load users.");
        }

        const loadedUsers: ManagedUser[] = (
          Array.isArray(data.users) ? data.users : []
        )
          .filter(
            (user: Record<string, unknown>) => typeof user.id === "string"
          )
          .map((user: Record<string, unknown>) => ({
            id: user.id as string,
            fullName:
              typeof user.fullName === "string" ? user.fullName : null,
            email: typeof user.email === "string" ? user.email : null,
            role: isUserRole(user.role) ? user.role : null,
            status: isUserStatus(user.status) ? user.status : "approved",
            teamId:
              typeof user.teamId === "string" ? user.teamId : null,
            mustChangePassword: user.mustChangePassword === true,
          }));

        setUsers(loadedUsers);

        // Keep the navigation badge in sync.
        const pendingCount = loadedUsers.filter(
          (user) => user.status === "pending"
        ).length;

        onPendingChange?.(pendingCount);
        window.dispatchEvent(
          new CustomEvent("districtlens:pending-users", {
            detail: pendingCount,
          })
        );

        setTeams(
          (Array.isArray(data.teams) ? data.teams : []).filter(
            (team: TeamOption) =>
              typeof team?.id === "string" &&
              typeof team?.name === "string"
          )
        );
      } catch (err) {
        if (silent) {
          console.error("Background refresh failed:", err);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong while loading users."
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [onPendingChange]
  );

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  // Auto refresh (paused while saving or approving)
  useAutoRefresh(() => void loadUsers(true), !saving && !approving);

  // Go back to page 1 when the search or filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterRole, filterStatus]);

  // Reset and close the edit modal
  function resetForm() {
    setFullName("");
    setEmail("");
    setRole("customer_service");
    setTeamId("");
    setEditingUser(null);
  }

  // Open Edit modal
  function openEditForm(user: ManagedUser) {
    setError("");
    setMessage("");

    setEditingUser(user);

    setFullName(user.fullName ?? "");
    setEmail(user.email ?? "");
    setRole(user.role ?? "customer_service");
    setTeamId(user.teamId ?? "");
  }

  // Update account
  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editingUser) return;

    setError("");
    setMessage("");

    if (!fullName.trim()) {
      setError("Please enter the user's full name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter the user's email address.");
      return;
    }

    if (role === "field_worker" && !teamId) {
      setError("Please select a team for this field account.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingUser.id,
          fullName: fullName.trim(),
          email: email.trim(),
          role,
          teamId: role === "field_worker" ? teamId : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update user.");
      }

      setMessage("User account updated successfully.");
      resetForm();
      await loadUsers(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  // Ask for confirmation first (styled dialog instead of window.confirm)
  function handleDelete(user: ManagedUser) {
    setDeleteTarget(user);
  }

  // Delete account (runs only after the user confirms)
  async function performDelete(user: ManagedUser) {
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: user.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete user.");
      }

      setMessage("User account deleted successfully.");
      await loadUsers(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while deleting the user."
      );
    }
  }

  // Open the approve / reject dialog
  function openApproveDialog(user: ManagedUser) {
    setApproveError("");
    setApproveTarget(user);
    setApproveRole(""); // the admin chooses the role
    setApproveTeamId("");
  }

  function closeApproveDialog() {
    if (approving) return;
    setApproveTarget(null);
    setApproveError("");
  }

  async function performApprove() {
    if (!approveTarget) return;

    if (!approveRole) {
      setApproveError("Please select a role for this account.");
      return;
    }

    if (approveRole === "field_worker" && !approveTeamId) {
      setApproveError("Please select a team for this field account.");
      return;
    }

    setApproveError("");
    setApproving(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: approveTarget.id,
          action: "approve",
          role: approveRole,
          teamId: approveRole === "field_worker" ? approveTeamId : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve the account.");
      }

      setMessage(`${approveTarget.fullName || "Account"} was approved.`);
      setApproveTarget(null);
      await loadUsers(true);
    } catch (err) {
      setApproveError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setApproving(false);
    }
  }

  async function performReject() {
    if (!approveTarget) return;

    setApproveError("");
    setApproving(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: approveTarget.id,
          action: "reject",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject the account.");
      }

      setMessage(`${approveTarget.fullName || "Account"} was rejected.`);
      setApproveTarget(null);
      await loadUsers(true);
    } catch (err) {
      setApproveError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setApproving(false);
    }
  }

  function teamName(id: string | null) {
    return teams.find((team) => team.id === id)?.name ?? null;
  }

  const teamOptions = teams.map((team) => ({
    value: team.id,
    label: team.name,
  }));

  // Filter accounts, with pending accounts always at the top
  const filteredUsers = users
    .filter((user) => {
      const search = searchTerm.toLowerCase();

      const matchesSearch =
        (user.fullName ?? "").toLowerCase().includes(search) ||
        (user.email ?? "").toLowerCase().includes(search);

      const matchesRole =
        filterRole === "all" ||
        (user.status === "approved" && user.role === filterRole);

      const matchesStatus =
        filterStatus === "all" || user.status === filterStatus;

      return matchesSearch && matchesRole && matchesStatus;
    })
    .sort(
      (a, b) =>
        Number(b.status === "pending") - Number(a.status === "pending")
    );

  // Pagination (10 per page)
  const {
    pageItems: pagedUsers,
    page: currentPage,
    totalPages,
  } = paginate(filteredUsers, page);

  // Summary counts
  const approvedUsers = users.filter((user) => user.status === "approved");

  const totalAdmins = approvedUsers.filter(
    (user) => user.role === "super_admin"
  ).length;

  const totalCustomerService = approvedUsers.filter(
    (user) => user.role === "customer_service"
  ).length;

  const totalFieldTeams = approvedUsers.filter(
    (user) => user.role === "field_worker"
  ).length;

  const totalPending = users.filter(
    (user) => user.status === "pending"
  ).length;

  // Approve needs a role, and a team when the role is Field Team
  const approveMissingRole = approveRole === "";
  const approveMissingTeam =
    approveRole === "field_worker" && !approveTeamId;

  return (
    <div className="space-y-8 border border-[#4438A8] bg-white p-6 text-slate-900 sm:p-8">
      {/* Page Header */}
      <div className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-indigo-100">
              DistrictLens / Administration
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              User Management
            </h2>

            <p className="mt-2 text-base text-indigo-100">
              Approve new accounts and manage their assigned roles.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadUsers()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {message && (
        <div
          role="status"
          className="flex items-start gap-3 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
          <p>{message}</p>

          <button
            type="button"
            onClick={() => setMessage("")}
            className="ml-auto"
            aria-label="Dismiss success message"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <p>{error}</p>

          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto"
            aria-label="Dismiss error message"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Pending approvals banner */}
      {!loading && totalPending > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            <span className="font-bold">{totalPending}</span> account
            {totalPending === 1 ? "" : "s"} waiting for approval.
          </p>

          <button
            type="button"
            onClick={() => setFilterStatus("pending")}
            className="border border-amber-400 bg-white px-3 py-1.5 font-semibold text-amber-900 hover:bg-amber-100"
          >
            Show pending
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="border border-slate-300 bg-white p-6 sm:p-7"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="mt-3 h-10 w-1/3" />
                </div>
                <Skeleton className="h-12 w-12 shrink-0" />
              </div>
            </div>
          ))
        ) : (
          <>
            <SummaryCard
              title="Total Accounts"
              count={users.length}
              icon={<Users size={22} />}
              accent="bg-[#123D73]"
            />

            <SummaryCard
              title="Admins"
              count={totalAdmins}
              icon={<ShieldCheck size={22} />}
              accent="bg-[#342992]"
            />

            <SummaryCard
              title="Customer Service"
              count={totalCustomerService}
              icon={<Headset size={22} />}
              accent="bg-sky-600"
            />

            <SummaryCard
              title="Field Teams"
              count={totalFieldTeams}
              icon={<HardHat size={22} />}
              accent="bg-amber-500"
            />
          </>
        )}
      </div>

      {/* Search + Filter */}
      <section className="border border-slate-300 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label htmlFor="user-search" className={labelClass}>
              Search
            </label>

            <div className="relative">
              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                id="user-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name or email"
                className={`${inputBase} py-2.5 pl-10 pr-3`}
              />
            </div>
          </div>

          <div className="w-full lg:w-56">
            <label htmlFor="role-filter" className={labelClass}>
              Role
            </label>

            <Dropdown
              id="role-filter"
              value={filterRole}
              onChange={setFilterRole}
              options={[
                { value: "all", label: "All Roles" },
                ...roleOptions,
              ]}
            />
          </div>

          <div className="w-full lg:w-56">
            <label htmlFor="status-filter" className={labelClass}>
              Status
            </label>

            <Dropdown
              id="status-filter"
              value={filterStatus}
              onChange={setFilterStatus}
              options={statusOptions}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-500">
          <span>
            {filteredUsers.length}{" "}
            {filteredUsers.length === 1 ? "account" : "accounts"} shown
          </span>

          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setFilterRole("all");
              setFilterStatus("all");
            }}
            className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Clear filters
          </button>
        </div>
      </section>

      {/* User Accounts Table */}
      <section className="overflow-hidden border border-[#4438A8] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-left [&_td]:border-r [&_td]:border-slate-200 [&_th]:border-r [&_th]:border-white/20 [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
            <thead className="border-b border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8]">
              <tr className="text-xs uppercase tracking-wide text-indigo-50">
                <th className="px-6 py-3.5 font-semibold">User</th>
                <th className="px-6 py-3.5 font-semibold">Role</th>
                <th className="px-6 py-3.5 font-semibold">
                  Account Status
                </th>
                <th className="px-6 py-3.5 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-300">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 shrink-0" />
                        <div>
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="mt-2 h-3 w-24" />
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <Skeleton className="h-6 w-28" />
                    </td>

                    <td className="px-6 py-4">
                      <Skeleton className="h-6 w-28" />
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-9 w-9" />
                        <Skeleton className="h-9 w-9" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-14 text-center">
                    <Users
                      size={30}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-3 text-sm font-medium text-slate-900">
                      No accounts found
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Try changing your search or filter.
                    </p>
                  </td>
                </tr>
              ) : (
                pagedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className={`transition hover:bg-slate-50 ${
                      user.status === "pending" ? "bg-amber-50/60" : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate-200 bg-slate-100 font-bold text-[#123D73]">
                          {(user.fullName || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {user.fullName || "Unnamed User"}
                          </p>

                          {user.email ? (
                            <p className="mt-0.5 text-xs text-slate-500">
                              {user.email}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-xs font-medium text-amber-700">
                              No email set. Edit to add one.
                            </p>
                          )}

                          <p className="mt-0.5 font-mono text-xs text-slate-500">
                            ID: {user.id.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {user.status === "approved" && user.role ? (
                        <>
                          <span
                            className={`inline-flex whitespace-nowrap border px-2 py-0.5 text-xs font-medium ${
                              roleColors[user.role]
                            }`}
                          >
                            {roleLabels[user.role]}
                          </span>

                          {user.role === "field_worker" &&
                            teamName(user.teamId) && (
                              <span className="ml-2 text-xs text-slate-500">
                                {teamName(user.teamId)}
                              </span>
                            )}
                        </>
                      ) : (
                        <span className="inline-flex whitespace-nowrap border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          No role assigned
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {user.status !== "approved" ? (
                        <span
                          className={`inline-flex whitespace-nowrap border px-2 py-0.5 text-xs font-medium ${
                            statusColors[user.status]
                          }`}
                        >
                          {user.status === "pending"
                            ? "Pending approval"
                            : "Rejected"}
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 whitespace-nowrap border px-2 py-0.5 text-xs font-medium ${
                            user.mustChangePassword
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-emerald-200 bg-emerald-50 text-emerald-800"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              user.mustChangePassword
                                ? "bg-amber-500"
                                : "bg-emerald-600"
                            }`}
                          />

                          {user.mustChangePassword
                            ? "Change Required"
                            : "Active"}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {user.status !== "approved" && (
                          <button
                            type="button"
                            onClick={() => openApproveDialog(user)}
                            aria-label={`Review ${
                              user.fullName || "this user"
                            }`}
                            title="Approve or reject"
                            className="border border-emerald-300 bg-emerald-50 p-2 text-emerald-700 transition hover:bg-emerald-100"
                          >
                            <UserCheck size={16} />
                          </button>
                        )}

                        {user.status === "approved" && (
                          <button
                            type="button"
                            onClick={() => openEditForm(user)}
                            aria-label={`Edit ${
                              user.fullName || "this user"
                            }`}
                            title="Edit user"
                            className="border border-slate-300 bg-white p-2 text-slate-600 transition hover:border-[#123D73] hover:bg-blue-50 hover:text-[#123D73]"
                          >
                            <Pencil size={16} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(user)}
                          aria-label={`Delete ${
                            user.fullName || "this user"
                          }`}
                          title="Delete user"
                          className="border border-slate-300 bg-white p-2 text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && (
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            total={filteredUsers.length}
            onPageChange={setPage}
          />
        )}

      </section>

      {/* Edit User Modal */}
      {editingUser &&
        createPortal(
          <div
            className="fixed inset-0 z-1000 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[2px]"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !saving) {
                resetForm();
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-user-title"
              className="my-auto w-full max-w-lg overflow-hidden border border-[#4438A8] bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-4 border-b border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-white/30 bg-white/10 text-white">
                    <Pencil size={20} />
                  </div>

                  <div>
                    <h2
                      id="edit-user-title"
                      className="text-lg font-bold text-white"
                    >
                      Edit User Account
                    </h2>

                    <p className="mt-1 text-sm text-indigo-100">
                      Update the user&apos;s name, role and team.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  aria-label="Close edit modal"
                  className="p-2 text-indigo-100 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 sm:p-8">
                <div className="space-y-6">
                  <div>
                    <label htmlFor="edit-fullName" className={labelClass}>
                      Full Name
                    </label>

                    <input
                      id="edit-fullName"
                      type="text"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Enter full name"
                      required
                      autoFocus
                      className={`${inputBase} px-3 py-2.5`}
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-email" className={labelClass}>
                      Email Address
                    </label>

                    <input
                      id="edit-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Enter email address"
                      required
                      autoComplete="off"
                      className={`${inputBase} px-3 py-2.5`}
                    />

                    <p className="mt-1.5 text-xs text-slate-500">
                      This is the email the user signs in with. Their password
                      stays the same.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="edit-role" className={labelClass}>
                      Account Role
                    </label>

                    <Dropdown
                      id="edit-role"
                      value={role}
                      onChange={(value) => setRole(value as UserRole)}
                      options={roleOptions}
                    />
                  </div>

                  {role === "field_worker" && (
                    <div>
                      <label htmlFor="edit-team" className={labelClass}>
                        Team
                      </label>

                      <Dropdown
                        id="edit-team"
                        value={teamId}
                        onChange={setTeamId}
                        options={teamOptions}
                        placeholder="Select team"
                      />
                    </div>
                  )}
                </div>

                <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-6">
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={saving}
                    className="border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 bg-[#123D73] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0D2F59] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <LoaderCircle
                          size={17}
                          className="animate-spin"
                        />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check size={17} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>
          </div>,
          document.body
        )}

      {/* Approve / Reject */}
      {approveTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-1100 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="approve-user-title"
              className="w-full max-w-md border border-[#DCD6FF] bg-white p-6 shadow-2xl sm:p-8"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <UserCheck size={26} />
              </div>

              <h2
                id="approve-user-title"
                className="mt-5 text-center text-xl font-bold text-[#27205C]"
              >
                Review account request
              </h2>

              <p className="mt-2 text-center text-sm leading-6 text-slate-600">
                <span className="font-semibold text-slate-900">
                  {approveTarget.fullName || "This user"}
                </span>
                {approveTarget.email ? ` (${approveTarget.email})` : ""}
              </p>

              <div className="mt-6 space-y-5">
                <div>
                  <label htmlFor="approve-role" className={labelClass}>
                    Assign role
                  </label>

                  <Dropdown
                    id="approve-role"
                    value={approveRole}
                    onChange={(value) => setApproveRole(value as UserRole)}
                    options={roleOptions}
                    placeholder="Select role"
                  />
                </div>

                {approveRole === "field_worker" && (
                  <div>
                    <label htmlFor="approve-team" className={labelClass}>
                      Assign team
                    </label>

                    <Dropdown
                      id="approve-team"
                      value={approveTeamId}
                      onChange={setApproveTeamId}
                      options={teamOptions}
                      placeholder="Select team"
                    />
                  </div>
                )}
              </div>

              {/* Summary of what will be saved */}
              <p className="mt-5 border border-slate-200 bg-slate-50 p-3 text-center text-sm text-slate-600">
                {approveRole === "" ? (
                  <span className="font-medium text-amber-700">
                    Select a role to continue.
                  </span>
                ) : (
                  <>
                    Approve as{" "}
                    <span className="font-semibold text-slate-900">
                      {roleLabels[approveRole]}
                    </span>
                    {approveRole === "field_worker" &&
                      teamName(approveTeamId) && (
                        <>
                          {" "}in{" "}
                          <span className="font-semibold text-slate-900">
                            {teamName(approveTeamId)}
                          </span>
                        </>
                      )}
                    {approveMissingTeam && (
                      <span className="mt-1 block font-medium text-amber-700">
                        Select a team to continue.
                      </span>
                    )}
                  </>
                )}
              </p>

              {approveError && (
                <p
                  role="alert"
                  className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {approveError}
                </p>
              )}

              <div className="mt-6 grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={closeApproveDialog}
                  disabled={approving}
                  className="border border-[#D9D4EE] px-3 py-3 text-sm font-semibold text-[#5145B5] transition hover:bg-indigo-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void performReject()}
                  disabled={approving || approveTarget.status === "rejected"}
                  className="inline-flex items-center justify-center gap-1.5 border border-red-300 px-3 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  <UserX size={15} />
                  Reject
                </button>

                <button
                  type="button"
                  onClick={() => void performApprove()}
                  disabled={approving || approveMissingRole || approveMissingTeam}
                  className="bg-linear-to-r from-[#342992] to-[#5366C8] px-3 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {approving ? "Saving..." : "Approve"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Delete Confirmation */}
      {deleteTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-1100 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
            role="presentation"
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-user-title"
              aria-describedby="delete-user-message"
              className="w-full max-w-md border border-[#DCD6FF] bg-white p-6 shadow-2xl sm:p-8"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 size={26} />
              </div>

              <h2
                id="delete-user-title"
                className="mt-5 text-center text-xl font-bold text-[#27205C]"
              >
                Delete this account?
              </h2>

              <p
                id="delete-user-message"
                className="mt-2 text-center text-sm leading-6 text-slate-600"
              >
                You are about to delete the account for{" "}
                <span className="font-semibold text-slate-900">
                  {deleteTarget.fullName || "this user"}
                </span>
                . This action cannot be undone.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="border border-[#D9D4EE] px-4 py-3 text-sm font-semibold text-[#5145B5] transition hover:bg-indigo-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = deleteTarget;
                    setDeleteTarget(null);
                    void performDelete(target);
                  }}
                  className="bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  Yes, delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function SummaryCard({
  title,
  count,
  icon,
  accent,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="relative border border-slate-300 bg-white p-6 sm:p-7">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} />

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-800">{title}</p>

          <p className="mt-3 text-4xl font-bold text-slate-900">
            {count}
          </p>
        </div>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-slate-200 bg-slate-50 text-[#123D73]">
          {icon}
        </div>
      </div>
    </div>
  );
}

/* Custom dropdown that replaces the native <select>, styled like the
   Create Report dropdowns. The list renders in a portal so it is never
   clipped by a modal, and always opens downward. */
function Dropdown({
  id,
  value,
  onChange,
  options,
  placeholder = "Select",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    left: number;
    width: number;
    top: number;
    maxHeight: number;
  } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);

  const close = useCallback(() => setOpen(false), []);

  const toggle = () => {
    if (open) {
      close();
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const spaceBelow = window.innerHeight - rect.bottom - 16;

    setPosition({
      left: rect.left,
      width: rect.width,
      top: rect.bottom + 4,
      maxHeight: Math.max(120, Math.min(280, spaceBelow)),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };

    const onScroll = (event: Event) => {
      if (listRef.current?.contains(event.target as Node)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  return (
    <>
      <button
        id={id}
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className="flex w-full items-center justify-between border border-slate-300 bg-white px-3 py-2.5 text-left text-sm text-slate-800 shadow-sm transition-colors hover:border-[#123D73] focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20"
      >
        <span
          className={
            selected
              ? "truncate font-medium text-slate-900"
              : "truncate text-slate-500"
          }
        >
          {selected?.label ?? placeholder}
        </span>

        <svg
          className={`ml-2 h-4 w-4 shrink-0 text-slate-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={listRef}
            style={{
              left: position.left,
              width: position.width,
              top: position.top,
              maxHeight: position.maxHeight,
            }}
            className="fixed z-1200 flex flex-col overflow-hidden border border-slate-200 bg-white shadow-lg"
          >
            <div
              role="listbox"
              className="min-h-0 max-h-56 flex-1 overflow-y-auto p-1"
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    close();
                  }}
                  className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
                    option.value === value
                      ? "bg-blue-50 font-semibold text-[#123D73]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/* -------------------------
   SHARED HELPERS
   (skeleton, pagination, auto refresh)
------------------------- */

const PAGE_SIZE = 10;
const REFRESH_MS = 30_000; // auto refresh every 30 seconds

function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    pageItems: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
  };
}

// Runs `refresh` every REFRESH_MS while the tab is visible, and once more
// when the user comes back to the tab.
function useAutoRefresh(
  refresh: () => void,
  enabled = true,
  intervalMs = REFRESH_MS
) {
  const latest = useRef(refresh);

  useEffect(() => {
    latest.current = refresh;
  });

  useEffect(() => {
    if (!enabled) return;

    const run = () => {
      if (document.visibilityState === "visible") latest.current();
    };

    const id = window.setInterval(run, intervalMs);
    document.addEventListener("visibilitychange", run);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", run);
    };
  }, [enabled, intervalMs]);
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-slate-200 ${className}`}
    />
  );
}

function Pagination({
  page,
  totalPages,
  total,
  pageSize = PAGE_SIZE,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const btn =
    "border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3 border-t border-slate-300 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <p className="text-sm text-slate-600">
        Showing{" "}
        <span className="font-semibold text-slate-900">
          {from}–{to}
        </span>{" "}
        of <span className="font-semibold text-slate-900">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={btn}
        >
          Previous
        </button>

        <span className="px-3 text-sm font-semibold text-slate-700">
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={btn}
        >
          Next
        </button>
      </div>
    </div>
  );
}