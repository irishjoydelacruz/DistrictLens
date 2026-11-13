
"use client";

import { useState } from "react";

type UserRole = "super_admin" | "customer_service" | "field_team";

type CreatedUser = {
  fullName: string;
  email: string;
  role: UserRole;
  temporaryPassword: string;
};

export default function UsersPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("customer_service");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setCreatedUser(null);
    setCopied(false);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to create account.");
        return;
      }

      if (!data.temporaryPassword) {
        setMessage(
          "Account response did not include a temporary password. Verify the account in Supabase before retrying."
        );
        return;
      }

      setCreatedUser({
        fullName: data.user.fullName,
        email: data.user.email,
        role: data.user.role,
        temporaryPassword: data.temporaryPassword,
      });

      setMessage("Account created successfully.");
      setFullName("");
      setEmail("");
      setRole("customer_service");
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyPassword() {
    if (!createdUser) return;

    try {
      await navigator.clipboard.writeText(
        createdUser.temporaryPassword
      );
      setCopied(true);
    } catch {
      setMessage(
        "Unable to copy automatically. Select and copy the password manually."
      );
    }
  }

  function getRoleLabel(value: UserRole) {
    if (value === "super_admin") return "Super Admin";
    if (value === "customer_service") return "Customer Service";
    return "Field Team";
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900">
          User Management
        </h1>

        <p className="mt-2 text-gray-600">
          Add and manage DistrictLens users.
        </p>

        <div className="mt-8 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">
            Add New User
          </h2>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-gray-700"
              >
                Full Name
              </label>

              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter full name"
                autoComplete="name"
                required
                className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                autoComplete="email"
                required
                className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3"
              />
            </div>

            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700"
              >
                Role
              </label>

              <select
                id="role"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as UserRole)
                }
                className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3"
              >
                <option value="super_admin">Super Admin</option>
                <option value="customer_service">
                  Customer Service
                </option>
                <option value="field_team">Field Team</option>
              </select>
            </div>

            {message && (
              <p
                role="status"
                className={`rounded-lg p-3 text-sm ${
                  createdUser
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          {createdUser && (
            <section className="mt-6 space-y-4 rounded-xl border border-green-200 bg-green-50 p-5">
              <h3 className="text-lg font-semibold text-green-900">
                Account Created
              </h3>

              <p className="text-sm text-green-800">
                Share these details securely with the staff member.
                The temporary password will not be emailed.
              </p>

              <div className="space-y-1 text-sm text-gray-800">
                <p>
                  <span className="font-medium">Name:</span>{" "}
                  {createdUser.fullName}
                </p>
                <p>
                  <span className="font-medium">Email:</span>{" "}
                  {createdUser.email}
                </p>
                <p>
                  <span className="font-medium">Role:</span>{" "}
                  {getRoleLabel(createdUser.role)}
                </p>
              </div>

              <div>
                <label
                  htmlFor="temporaryPassword"
                  className="block text-sm font-medium text-gray-700"
                >
                  Temporary Password
                </label>

                <input
                  id="temporaryPassword"
                  type="text"
                  readOnly
                  value={createdUser.temporaryPassword}
                  className="mt-2 w-full rounded-lg border border-green-300 bg-white px-3 py-3 font-mono text-sm"
                />
              </div>

              <button
                type="button"
                onClick={handleCopyPassword}
                className="w-full rounded-lg border border-green-700 px-4 py-3 font-medium text-green-800 hover:bg-green-100"
              >
                {copied ? "Password Copied" : "Copy Temporary Password"}
              </button>

              <p className="text-xs text-green-800">
                The user must change this password before accessing
                the portal. Store and share it securely.
              </p>

              <button
                type="button"
                onClick={() => {
                  setCreatedUser(null);
                  setCopied(false);
                  setMessage("");
                }}
                className="text-sm font-medium text-gray-600 underline"
              >
                Hide password
              </button>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}