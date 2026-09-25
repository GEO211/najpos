import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  applyRememberToAuthCookies,
  isRememberSession,
} from "@/lib/auth-session";
import { getSupabaseKey } from "@/lib/supabase-key";

type CreateClientOptions = {
  rememberMe?: boolean;
};

export async function createClient(options?: CreateClientOptions) {
  const cookieStore = await cookies();
  const rememberMe =
    options?.rememberMe ?? isRememberSession(cookieStore);

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getSupabaseKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            applyRememberToAuthCookies(cookiesToSet, rememberMe).forEach(
              ({ name, value, options: cookieOptions }) =>
                cookieStore.set(name, value, cookieOptions)
            );
          } catch {
            // Called from Server Component
          }
        },
      },
    }
  );
}

export async function createServiceClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const { getServiceRoleKey } = await import("@/lib/admin-users");

  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );
}
