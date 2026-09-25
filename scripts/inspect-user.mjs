import { createPgClient, getEmailArg } from "./load-env.mjs";

const email = getEmailArg();
const client = createPgClient();

await client.connect();

const result = await client.query(
  `SELECT id, email, aud, role, instance_id,
          email_confirmed_at, confirmation_token, recovery_token,
          raw_app_meta_data, raw_user_meta_data,
          encrypted_password IS NOT NULL AS has_password,
          created_at, updated_at
   FROM auth.users WHERE email = $1`,
  [email]
);

console.log(JSON.stringify(result.rows[0], null, 2));
await client.end();
