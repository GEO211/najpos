import { createPgClient, getDbUrl, loadEnv } from "./load-env.mjs";

export const DEFAULT_ADMIN = {
  email: "admin@haliya.com",
  password: "HALIYA@121",
  fullName: "HALIYA Admin",
};

export function getAdminConfig() {
  loadEnv();
  return {
    email: process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN.email,
    password: process.env.ADMIN_PASSWORD?.trim() || DEFAULT_ADMIN.password,
    fullName: process.env.ADMIN_FULL_NAME?.trim() || DEFAULT_ADMIN.fullName,
  };
}

async function ensureIdentity(client, userId, userEmail) {
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
    [userId, userEmail]
  );
}

async function fixAuthTokenColumns(client, userId) {
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

export async function ensureAdminUser(options = {}) {
  const { email, password, fullName } = getAdminConfig();
  const ownsClient = !options.client;
  const client = options.client ?? createPgClient();

  if (ownsClient) {
    console.log("Using database:", getDbUrl().replace(/:[^:@/]+@/, ":****@"));
    await client.connect();
  }

  const existing = await client.query(
    "SELECT id FROM auth.users WHERE email = $1",
    [email]
  );

  let userId;

  if (existing.rows.length > 0) {
    userId = existing.rows[0].id;

    await client.query(
      `UPDATE auth.users
       SET encrypted_password = crypt($2, gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
           updated_at = NOW()
       WHERE id = $1`,
      [userId, password]
    );

    await client.query(
      `UPDATE profiles
       SET role = 'owner', full_name = $2, is_active = true
       WHERE id = $1`,
      [userId, fullName]
    );

    await ensureIdentity(client, userId, email);
    await fixAuthTokenColumns(client, userId);
    console.log("Default admin updated:", email);
  } else {
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
      [email, password, JSON.stringify({ full_name: fullName, role: "owner" })]
    );

    userId = result.rows[0].id;

    await client.query(
      `UPDATE profiles
       SET role = 'owner', full_name = $2, is_active = true
       WHERE id = $1`,
      [userId, fullName]
    );

    await ensureIdentity(client, userId, email);
    await fixAuthTokenColumns(client, userId);
    console.log("Default admin created:", email);
  }

  if (ownsClient) {
    await client.end();
  }

  return { email, fullName };
}
