import { redirect } from "next/navigation";
import type { Profile, UserRole } from "@/types/database";
import { createClient } from "@/lib/server";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

export async function requireAuth(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.is_active) redirect("/login?error=account_inactive");
  return profile;
}

export async function requireOwner(): Promise<Profile> {
  const profile = await requireAuth();
  if (profile.role !== "owner") redirect("/pos");
  return profile;
}

export async function requireRole(roles: UserRole[]): Promise<Profile> {
  const profile = await requireAuth();
  if (!roles.includes(profile.role)) {
    redirect(profile.role === "owner" ? "/owner/dashboard" : "/pos");
  }
  return profile;
}
