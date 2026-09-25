import { createPgClient, getEmailArg } from "./load-env.mjs";

const email = getEmailArg();
const client = createPgClient();

await client.connect();

const result = await client.query(
  `UPDATE profiles SET role = 'owner', full_name = COALESCE(NULLIF(full_name, ''), 'Store Owner')
   WHERE email = $1 RETURNING email, role`,
  [email]
);

if (result.rowCount === 0) {
  console.error(`No profile found for ${email}. Create the user in Supabase Auth first.`);
  process.exit(1);
}

console.log("Owner set:", result.rows[0]);
await client.end();
