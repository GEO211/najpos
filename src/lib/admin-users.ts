import pg from "pg";
import { withPgClient } from "@/lib/db";

type DbResult<T> = { data: T } | { error: string };

async function ensureIdentity(
  client: pg.Client,
  userId: string,
  email: string
) {
  const existing = await client.query(
    "SELECT id FROM auth.identities WHERE user_id = $1 AND provider = 'email'",
    [userId]
  );

  if (existing.rows.length > 0) return;

  await client.query(
    `INSERT INTO auth.identities (
       id, user_id, provider_id, provider, identity_data, created_at, updated_at
     ) VALUES (
       gen_random_uuid(),
       $1::uuid,
       $1::text,
       'email',
       jsonb_build_object(
         'sub', $1::text,
         'email', $2::text,
         'email_verified', true
       ),
       NOW(),
       NOW()
     )`,
    [userId, email]
  );
}

async function fixAuthTokenColumns(client: pg.Client, userId: string) {
  await client.query(
    `UPDATE auth.users
     SET
       confirmation_token = COALESCE(confirmation_token, ''),
       email_change = COALESCE(email_change, ''),
       email_change_token_new = COALESCE(email_change_token_new, ''),
       email_change_token_current = COALESCE(email_change_token_current, ''),
       recovery_token = COALESCE(recovery_token, ''),
       phone_change = COALESCE(phone_change, ''),
       phone_change_token = COALESCE(phone_change_token, ''),
       reauthentication_token = COALESCE(reauthentication_token, '')
     WHERE id = $1`,
    [userId]
  );
}

export function hasAdminBackend(): boolean {
  return Boolean(
    getServiceRoleKey() ||
      process.env.DATABASE_POOLER_URL ||
      process.env.DATABASE_URL
  );
}

export function getServiceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;

  if (key.includes("@") || key.includes(" ")) return null;
  if (key.startsWith("sb_publishable_")) return null;

  if (key.startsWith("eyJ") || key.startsWith("sb_secret_")) {
    return key;
  }

  return null;
}

export function useServiceRoleClient(): boolean {
  return Boolean(getServiceRoleKey());
}

export async function createUserViaDb(input: {
  email: string;
  password: string;
  fullName: string;
  role: string;
}): Promise<DbResult<{ userId: string }>> {
  const email = input.email.trim().toLowerCase();
  const role = input.role === "owner" ? "owner" : "cashier";

  try {
    return await withPgClient(async (client) => {
      const existing = await client.query(
        "SELECT id FROM auth.users WHERE email = $1",
        [email]
      );

      if (existing.rows.length > 0) {
        return { error: "A user with this email already exists." };
      }

      const result = await client.query(
        `INSERT INTO auth.users (
           instance_id, id, aud, role, email, encrypted_password,
           email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
           created_at, updated_at
         ) VALUES (
           '00000000-0000-0000-0000-000000000000',
           gen_random_uuid(), 'authenticated', 'authenticated', $1,
           crypt($2, gen_salt('bf')), NOW(),
           '{"provider":"email","providers":["email"]}'::jsonb,
           $3::jsonb, NOW(), NOW()
         )
         RETURNING id`,
        [
          email,
          input.password,
          JSON.stringify({ full_name: input.fullName, role }),
        ]
      );

      const userId = result.rows[0].id as string;

      await client.query(
        `UPDATE profiles
         SET full_name = $2, role = $3::user_role, is_active = true
         WHERE id = $1`,
        [userId, input.fullName, role]
      );

      await ensureIdentity(client, userId, email);
      await fixAuthTokenColumns(client, userId);

      return { data: { userId } };
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create user.",
    };
  }
}

export async function deleteUserViaDb(userId: string): Promise<
  DbResult<{
    deleted: boolean;
    message: string;
  }>
> {
  try {
    return await withPgClient(async (client) => {
      const profileResult = await client.query(
        "SELECT role FROM profiles WHERE id = $1",
        [userId]
      );

      if (profileResult.rows.length === 0) {
        return { error: "User not found." };
      }

      const role = profileResult.rows[0].role as string;

      if (role === "owner") {
        const ownerCount = await client.query(
          "SELECT COUNT(*)::int AS count FROM profiles WHERE role = 'owner'"
        );

        if ((ownerCount.rows[0]?.count as number) <= 1) {
          return { error: "Cannot delete the only owner account." };
        }
      }

      const salesCount = await client.query(
        "SELECT COUNT(*)::int AS count FROM sales WHERE cashier_id = $1",
        [userId]
      );

      if ((salesCount.rows[0]?.count as number) > 0) {
        await client.query(
          "UPDATE profiles SET is_active = false WHERE id = $1",
          [userId]
        );

        return {
          data: {
            deleted: false,
            message:
              "User has sales history and was deactivated instead of deleted.",
          },
        };
      }

      await client.query("DELETE FROM auth.users WHERE id = $1", [userId]);

      return {
        data: {
          deleted: true,
          message: "User deleted successfully.",
        },
      };
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete user.",
    };
  }
}
