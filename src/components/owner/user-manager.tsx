"use client";

import { useState } from "react";
import { createUser, deleteUser, toggleUserActive } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Profile } from "@/types/database";
import { Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { LIMITS } from "@/lib/validation";

interface UserManagerProps {
  users: Profile[];
  currentUserId: string;
}

export function UserManager({ users, currentUserId }: UserManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleCreate(formData: FormData) {
    setError(null);
    setSuccess(null);
    const result = await createUser(formData);
    if (result?.error) setError(result.error);
    else {
      setSuccess("User created successfully");
      setShowForm(false);
    }
  }

  async function handleToggle(userId: string, isActive: boolean) {
    setError(null);
    setSuccess(null);
    const result = await toggleUserActive(userId, isActive);
    if (result?.error) setError(result.error);
    else {
      setSuccess(isActive ? "User activated." : "User deactivated.");
    }
  }

  async function handleDelete(user: Profile) {
    const label = user.full_name || user.email;
    if (
      !confirm(
        `Delete ${label}? Users with sales history will be deactivated instead.`
      )
    ) {
      return;
    }

    setError(null);
    setSuccess(null);
    const result = await deleteUser(user.id);
    if (result?.error) setError(result.error);
    else setSuccess(result.message ?? "User deleted successfully.");
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
          {success}
        </div>
      )}

      <Button className="mb-6" onClick={() => setShowForm(!showForm)}>
        <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
        Add User
      </Button>

      {showForm && (
        <form
          action={handleCreate}
          className="mb-6 rounded-lg border border-neutral-200 bg-white p-6"
        >
          <h3 className="mb-4 text-sm font-semibold text-neutral-900">New User</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="full_name" label="Full Name" maxLength={LIMITS.fullName} required />
            <Input name="email" label="Email" type="email" maxLength={LIMITS.email} required />
            <Input name="password" label="Password" type="password" maxLength={LIMITS.password} required minLength={6} />
            <Input name="admin_code" label="Admin Code" type="password" maxLength={LIMITS.adminCode} required />
            <Select
              name="role"
              label="Role"
              options={[
                { value: "cashier", label: "Cashier" },
                { value: "owner", label: "Owner" },
              ]}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" size="sm">Create User</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Name</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Email</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Role</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Status</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Created</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {users.map((user) => {
              const isSelf = user.id === currentUserId;

              return (
                <tr key={user.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {user.full_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-neutral-200 px-2.5 py-0.5 text-xs capitalize text-neutral-600">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                        user.is_active
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border border-neutral-200 bg-neutral-100 text-neutral-500"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          user.is_active ? "bg-emerald-500" : "bg-neutral-400"
                        )}
                      />
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggle(user.id, !user.is_active)}
                        className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                        title={user.is_active ? "Deactivate account" : "Activate account"}
                      >
                        {user.is_active ? (
                          <UserX className="h-4 w-4" strokeWidth={1.5} />
                        ) : (
                          <UserCheck className="h-4 w-4" strokeWidth={1.5} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(user)}
                        disabled={isSelf}
                        className={cn(
                          "rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600",
                          isSelf && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-neutral-400"
                        )}
                        title={
                          isSelf
                            ? "You cannot delete your own account"
                            : "Delete account"
                        }
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
