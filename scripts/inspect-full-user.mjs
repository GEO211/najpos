import { createPgClient, getEmailArg } from "./load-env.mjs";

const email = getEmailArg();
const client = createPgClient();

await client.connect();

const result = await client.query(
  `SELECT u.id, u.email, u.aud, u.role, u.instance_id,
          u.email_confirmed_at, u.confirmation_token, u.recovery_token,
          u.raw_app_meta_data, u.raw_user_meta_data,
          u.encrypted_password IS NOT NULL AS has_password,
          u.created_at, u.updated_at,
          p.role AS profile_role, p.is_active, p.full_name
   FROM auth.users u
   LEFT JOIN profiles p ON p.id = u.id
   WHERE u.email = $1`,
  [email]
);

console.log(JSON.stringify(result.rows[0], null, 2));
await client.end();
