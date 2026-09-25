import { createPgClient, getEmailArg } from "./load-env.mjs";

const email = getEmailArg();
const client = createPgClient();

await client.connect();

const user = (
  await client.query("SELECT id FROM auth.users WHERE email = $1", [email])
).rows[0];

if (!user) {
  console.error("User not found");
  process.exit(1);
}

const userId = user.id;

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

console.log("Identity created for", email);
await client.end();
