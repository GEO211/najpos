import { createClient } from "@/lib/server";
import { requireOwner } from "@/lib/auth";
import { UserManager } from "@/components/owner/user-manager";

export default async function UsersPage() {
  const profile = await requireOwner();
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <div className="mb-8 border-b border-neutral-200 pb-6">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Users
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage owner and cashier accounts
        </p>
      </div>

      <UserManager users={users ?? []} currentUserId={profile.id} />
    </div>
  );
}
